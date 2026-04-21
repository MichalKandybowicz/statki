const Room = require('../models/Room');
const Game = require('../models/Game');
const BoardTemplate = require('../models/BoardTemplate');
const ShipTemplate = require('../models/ShipTemplate');
const { initGame, processMove, checkWinCondition, getPlayerView, switchTurn } = require('../engine/gameEngine');
const { useLinearShot, useRandomShot, useTargetShot, useSonar, tickCooldowns } = require('../engine/abilityEngine');
const { startTurn, endTurn, checkSkips, isTurnTimedOut } = require('../engine/turnEngine');
const { validatePlacement } = require('../utils/shipPlacement');
const { emitToUser } = require('./index');

// Per-game fleet staging: Map<roomId, Map<userId, fleet>>
const stagedFleets = new Map();

function registerGameHandlers(io, socket, connectedUsers, turnTimers) {
  const userId = socket.user._id.toString();

  /**
   * Starts a turn timer for the current player.
   */
  function scheduleTurnTimer(game, room) {
    const gameId = game._id.toString();
    clearTurnTimer(gameId);

    const timeLimit = (room?.settings?.turnTimeLimit || 60) * 1000;
    const timer = setTimeout(async () => {
      try {
        const freshGame = await Game.findById(gameId);
        if (!freshGame || freshGame.status !== 'in_game') return;

        const currentPlayerId = freshGame.turn.toString();
        const { skips, lost } = checkSkips(freshGame, currentPlayerId);

        if (lost) {
          const winnerId = freshGame.players.find((p) => p.toString() !== currentPlayerId);
          freshGame.status = 'finished';
          freshGame.winnerId = winnerId;
          await freshGame.save();

          await Room.findByIdAndUpdate(freshGame.roomId, { status: 'finished' });

          for (const pid of freshGame.players) {
            emitToUser(io, connectedUsers, pid.toString(), 'game_over', {
              winnerId: winnerId ? winnerId.toString() : null,
            });
          }
          return;
        }

        const nextPlayerId = endTurn(freshGame, currentPlayerId);
        tickCooldowns(freshGame, nextPlayerId);
        await freshGame.save();

        const freshRoom = await Room.findById(freshGame.roomId);

        for (const pid of freshGame.players) {
          const pidStr = pid.toString();
          emitToUser(io, connectedUsers, pidStr, 'turn_update', {
            turn: nextPlayerId,
            turnStartedAt: freshGame.turnStartedAt,
            skips: Object.fromEntries(freshGame.skips),
          });
        }

        scheduleTurnTimer(freshGame, freshRoom);
      } catch (err) {
        console.error('Turn timer error:', err);
      }
    }, timeLimit);

    turnTimers.set(gameId, timer);
  }

  function clearTurnTimer(gameId) {
    const existing = turnTimers.get(gameId.toString());
    if (existing) {
      clearTimeout(existing);
      turnTimers.delete(gameId.toString());
    }
  }

  // place_fleet: player submits their fleet placement during setup
  socket.on('place_fleet', async ({ roomId, fleet } = {}) => {
    try {
      if (!roomId || !Array.isArray(fleet)) {
        return socket.emit('error', { message: 'roomId and fleet are required' });
      }

      const room = await Room.findById(roomId);
      if (!room) return socket.emit('error', { message: 'Room not found' });

      const isPlayer = room.players.some((p) => p.userId.toString() === userId);
      if (!isPlayer) return socket.emit('error', { message: 'Not in this room' });

      if (room.status !== 'setup' && room.status !== 'waiting') {
        return socket.emit('error', { message: 'Room is not in setup phase' });
      }

      // Resolve ship templates and validate
      const resolvedFleet = [];
      for (const item of fleet) {
        const ship = await ShipTemplate.findById(item.shipTemplateId);
        if (!ship) {
          return socket.emit('error', { message: `Ship template ${item.shipTemplateId} not found` });
        }
        resolvedFleet.push({
          shipTemplateId: ship._id,
          positions: item.positions,
          abilityType: ship.abilityType,
          hits: [],
          isSunk: false,
          cooldownRemaining: 0,
        });
      }

      // Load board template tiles if set
      let templateTiles = null;
      if (room.settings.boardTemplateId) {
        const tmpl = await BoardTemplate.findById(room.settings.boardTemplateId);
        if (tmpl) templateTiles = tmpl.tiles;
      }

      const placementResult = validatePlacement(
        resolvedFleet,
        templateTiles,
        room.settings.boardSize
      );
      if (!placementResult.valid) {
        return socket.emit('error', { message: placementResult.error });
      }

      // Stage fleet
      if (!stagedFleets.has(roomId)) {
        stagedFleets.set(roomId, new Map());
      }
      stagedFleets.get(roomId).set(userId, resolvedFleet);

      // Move room to setup if still waiting
      if (room.status === 'waiting') {
        room.status = 'setup';
        await room.save();
      }

      socket.emit('fleet_accepted', { message: 'Fleet placement accepted' });

      // Check if all players have submitted fleets
      const roomFleets = stagedFleets.get(roomId);
      const allSubmitted = room.players.every((p) => roomFleets.has(p.userId.toString()));

      if (allSubmitted && room.players.length === 2) {
        const playerFleets = new Map(roomFleets);
        stagedFleets.delete(roomId);

        const game = await initGame(room, playerFleets, templateTiles);

        room.status = 'in_game';
        room.gameId = game._id;
        await room.save();

        for (const player of room.players) {
          const pid = player.userId.toString();
          const playerView = getPlayerView(game, pid);
          emitToUser(io, connectedUsers, pid, 'game_start', {
            gameId: game._id.toString(),
            boardSize: game.boardSize,
            boards: playerView,
            turn: game.turn.toString(),
            turnStartedAt: game.turnStartedAt,
            players: game.players.map((p) => p.toString()),
          });
        }

        scheduleTurnTimer(game, room);
      }
    } catch (err) {
      console.error('place_fleet error:', err);
      socket.emit('error', { message: 'Failed to place fleet' });
    }
  });

  // make_move
  socket.on('make_move', async ({ gameId, x, y } = {}) => {
    try {
      if (!gameId || x === undefined || y === undefined) {
        return socket.emit('error', { message: 'gameId, x, and y are required' });
      }

      const game = await Game.findById(gameId);
      if (!game) return socket.emit('error', { message: 'Game not found' });
      if (game.status !== 'in_game') return socket.emit('error', { message: 'Game is not active' });
      if (game.turn.toString() !== userId) {
        return socket.emit('error', { message: 'Not your turn' });
      }

      if (x < 0 || x >= game.boardSize || y < 0 || y >= game.boardSize) {
        return socket.emit('error', { message: 'Move out of bounds' });
      }

      const result = processMove(game, userId, x, y);
      if (result.alreadyShot) {
        return socket.emit('error', { message: 'Cell already targeted' });
      }

      const winnerId = checkWinCondition(game);

      if (winnerId) {
        game.status = 'finished';
        game.winnerId = winnerId;
        await game.save();

        await Room.findByIdAndUpdate(game.roomId, { status: 'finished' });
        clearTurnTimer(gameId);

        for (const pid of game.players) {
          emitToUser(io, connectedUsers, pid.toString(), 'move_result', {
            playerId: userId,
            x,
            y,
            hit: result.hit,
            sunk: result.sunk,
            shipIndex: result.shipIndex,
          });
          emitToUser(io, connectedUsers, pid.toString(), 'game_over', { winnerId });
        }
        return;
      }

      if (!result.hit) {
        // Miss: switch turn
        const nextPlayerId = endTurn(game, userId);
        tickCooldowns(game, nextPlayerId);
        await game.save();

        const room = await Room.findById(game.roomId);

        for (const pid of game.players) {
          emitToUser(io, connectedUsers, pid.toString(), 'move_result', {
            playerId: userId,
            x,
            y,
            hit: false,
            sunk: false,
          });
          emitToUser(io, connectedUsers, pid.toString(), 'turn_update', {
            turn: nextPlayerId,
            turnStartedAt: game.turnStartedAt,
          });
        }

        clearTurnTimer(gameId);
        scheduleTurnTimer(game, room);
      } else {
        // Hit: same player continues — reset turn timer start time
        game.lastActionAt = new Date();
        game.turnStartedAt = new Date();
        game.markModified('turnStartedAt');
        await game.save();

        for (const pid of game.players) {
          emitToUser(io, connectedUsers, pid.toString(), 'move_result', {
            playerId: userId,
            x,
            y,
            hit: true,
            sunk: result.sunk,
            shipIndex: result.shipIndex,
          });
        }

        // Reset turn timer (player gets full time for next shot)
        const room = await Room.findById(game.roomId);
        clearTurnTimer(gameId);
        scheduleTurnTimer(game, room);
      }
    } catch (err) {
      console.error('make_move error:', err);
      socket.emit('error', { message: 'Failed to process move' });
    }
  });

  // use_ability
  socket.on('use_ability', async ({ gameId, shipIndex, targets } = {}) => {
    try {
      if (!gameId || shipIndex === undefined) {
        return socket.emit('error', { message: 'gameId and shipIndex are required' });
      }

      const game = await Game.findById(gameId);
      if (!game) return socket.emit('error', { message: 'Game not found' });
      if (game.status !== 'in_game') return socket.emit('error', { message: 'Game is not active' });
      if (game.turn.toString() !== userId) {
        return socket.emit('error', { message: 'Not your turn' });
      }

      const fleet = game.fleets.get(userId);
      if (!fleet || !fleet[shipIndex]) {
        return socket.emit('error', { message: 'Ship not found' });
      }

      const ship = fleet[shipIndex];
      let results;

      switch (ship.abilityType) {
        case 'linear':
          results = useLinearShot(game, userId, shipIndex);
          break;
        case 'random':
          results = useRandomShot(game, userId, shipIndex);
          break;
        case 'target':
          results = useTargetShot(game, userId, shipIndex, targets);
          break;
        case 'sonar': {
          const sonarResult = useSonar(game, userId, shipIndex);
          await game.save();
          const room = await Room.findById(game.roomId);
          clearTurnTimer(gameId);
          const nextPlayerId = endTurn(game, userId);
          tickCooldowns(game, nextPlayerId);
          await game.save();
          scheduleTurnTimer(game, room);

          socket.emit('sonar_result', sonarResult);
          for (const pid of game.players) {
            if (pid.toString() !== userId) {
              emitToUser(io, connectedUsers, pid.toString(), 'turn_update', {
                turn: nextPlayerId,
                turnStartedAt: game.turnStartedAt,
              });
            }
          }
          emitToUser(io, connectedUsers, userId, 'turn_update', {
            turn: nextPlayerId,
            turnStartedAt: game.turnStartedAt,
          });
          return;
        }
        default:
          return socket.emit('error', { message: 'Unknown ability type' });
      }

      const winnerId = checkWinCondition(game);
      if (winnerId) {
        game.status = 'finished';
        game.winnerId = winnerId;
        await game.save();
        await Room.findByIdAndUpdate(game.roomId, { status: 'finished' });
        clearTurnTimer(gameId);

        for (const pid of game.players) {
          emitToUser(io, connectedUsers, pid.toString(), 'ability_result', {
            results,
            shipIndex,
            playerId: userId,
          });
          emitToUser(io, connectedUsers, pid.toString(), 'game_over', { winnerId });
        }
        return;
      }

      const room = await Room.findById(game.roomId);
      clearTurnTimer(gameId);
      const nextPlayerId = endTurn(game, userId);
      tickCooldowns(game, nextPlayerId);
      await game.save();
      scheduleTurnTimer(game, room);

      for (const pid of game.players) {
        emitToUser(io, connectedUsers, pid.toString(), 'ability_result', {
          results,
          shipIndex,
          playerId: userId,
        });
        emitToUser(io, connectedUsers, pid.toString(), 'turn_update', {
          turn: nextPlayerId,
          turnStartedAt: game.turnStartedAt,
        });
      }
    } catch (err) {
      console.error('use_ability error:', err);
      socket.emit('error', { message: err.message || 'Failed to use ability' });
    }
  });

  // reconnect_game: send current game state to rejoining player
  socket.on('reconnect_game', async ({ gameId } = {}) => {
    try {
      if (!gameId) return socket.emit('error', { message: 'gameId is required' });

      const game = await Game.findById(gameId);
      if (!game) return socket.emit('error', { message: 'Game not found' });

      const isPlayer = game.players.some((p) => p.toString() === userId);
      if (!isPlayer) return socket.emit('error', { message: 'Not a player in this game' });

      const playerView = getPlayerView(game, userId);

      socket.emit('game_state', {
        gameId: game._id.toString(),
        boardSize: game.boardSize,
        boards: playerView,
        turn: game.turn ? game.turn.toString() : null,
        turnStartedAt: game.turnStartedAt,
        status: game.status,
        winnerId: game.winnerId ? game.winnerId.toString() : null,
        skips: Object.fromEntries(game.skips),
        players: game.players.map((p) => p.toString()),
        fleet: game.fleets.get(userId) || [],
      });
    } catch (err) {
      console.error('reconnect_game error:', err);
      socket.emit('error', { message: 'Failed to reconnect to game' });
    }
  });
}

module.exports = { registerGameHandlers };
