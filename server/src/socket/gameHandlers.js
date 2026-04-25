const Room = require('../models/Room');
const Game = require('../models/Game');
const User = require('../models/User');
const BoardTemplate = require('../models/BoardTemplate');
const ShipTemplate = require('../models/ShipTemplate');
const { initGame, processMove, checkWinCondition, getPlayerView } = require('../engine/gameEngine');
const {
  useLinearShot,
  useRandomShot,
  useTargetShot,
  useSonar,
  useScoutRocket,
  useHolyBomb,
  tickCooldowns,
} = require('../engine/abilityEngine');
const { endTurn, checkSkips } = require('../engine/turnEngine');
const { validatePlacement } = require('../utils/shipPlacement');
const { emitToUser } = require('./socketUtils');
const { ensureUniqueRoomPlayers, getPlayerUserId } = require('../utils/roomPlayers');
const { calculateRatedMatch } = require('../services/eloService');

// Per-game fleet staging: Map<roomId, Map<userId, fleet>>
const stagedFleets = new Map();

function getPlayerGamePayload(game, playerId) {
  return {
    gameId: game._id.toString(),
    boardSize: game.boardSize,
    turnTimeLimit: game.turnTimeLimit || 60,
    boards: getPlayerView(game, playerId),
    turn: game.turn ? game.turn.toString() : null,
    turnStartedAt: game.turnStartedAt,
    status: game.status,
    isRanked: !!game.isRanked,
    winnerId: game.winnerId ? game.winnerId.toString() : null,
    skips: Object.fromEntries(game.skips || []),
    players: game.players.map((p) => p.toString()),
    fleet: game.fleets.get(playerId.toString()) || [],
  };
}

function emitTurnUpdateToPlayers(io, connectedUsers, game, turnPlayerId) {
  for (const pid of game.players) {
    const pidStr = pid.toString();
    emitToUser(io, connectedUsers, pidStr, 'turn_update', {
      turn: turnPlayerId,
      turnStartedAt: game.turnStartedAt,
      skips: Object.fromEntries(game.skips || []),
      fleet: game.fleets.get(pidStr) || [],
    });
  }
}

function markGameAsFinished(game, { winnerId = null, endReason = 'win', finishedBy = null } = {}) {
  game.status = 'finished';
  game.winnerId = winnerId || null;
  game.endReason = endReason;
  game.finishedBy = finishedBy || null;
  game.endedAt = new Date();
}

async function applyRankedEloIfNeeded(game) {
  if (!game?.isRanked || game.eloApplied) return null;

  const players = (game.players || []).map((p) => p.toString());
  const winnerId = game.winnerId ? game.winnerId.toString() : null;
  if (players.length !== 2 || !winnerId) return null;

  const loserId = players.find((id) => id !== winnerId);
  if (!loserId) return null;

  const users = await User.find({ _id: { $in: players } });
  const byId = new Map(users.map((u) => [u._id.toString(), u]));
  const winner = byId.get(winnerId);
  const loser = byId.get(loserId);
  if (!winner || !loser) return null;

  const result = calculateRatedMatch({ winnerElo: winner.elo, loserElo: loser.elo });

  winner.elo = result.winner.after;
  loser.elo = result.loser.after;
  await Promise.all([winner.save(), loser.save()]);

  const eloChanges = {
    [winnerId]: result.winner,
    [loserId]: result.loser,
  };

  game.eloApplied = true;
  game.eloDeltas = {
    [winnerId]: result.winner.delta,
    [loserId]: result.loser.delta,
  };
  game.eloBefore = {
    [winnerId]: result.winner.before,
    [loserId]: result.loser.before,
  };
  game.eloAfter = {
    [winnerId]: result.winner.after,
    [loserId]: result.loser.after,
  };

  return eloChanges;
}

function buildGameOverPayload({ game, winnerId, surrenderedBy = null, eloChanges = null }) {
  const payload = {
    winnerId: winnerId ? winnerId.toString() : null,
    isRanked: !!game?.isRanked,
  };
  if (surrenderedBy) payload.surrenderedBy = surrenderedBy;
  if (eloChanges) payload.eloChanges = eloChanges;
  return payload;
}

async function closeRoomAfterGame(io, roomId) {
  const roomIdStr = roomId.toString();
  stagedFleets.delete(roomIdStr);
  await Room.deleteOne({ _id: roomId });
  // Lobby listens to room_update and refetches list.
  io.emit('room_update', { roomId: roomIdStr, closed: true });
}

function clearTurnTimer(turnTimers, gameId) {
  const existing = turnTimers.get(gameId.toString());
  if (existing) {
    clearTimeout(existing);
    turnTimers.delete(gameId.toString());
  }
}

function scheduleTurnTimer(io, connectedUsers, turnTimers, game, room) {
  const gameId = game._id.toString();
  clearTurnTimer(turnTimers, gameId);

  const timeLimit = (room?.settings?.turnTimeLimit || 60) * 1000;
  const timer = setTimeout(async () => {
    try {
      const freshGame = await Game.findById(gameId);
      if (!freshGame || freshGame.status !== 'in_game') return;

      const currentPlayerId = freshGame.turn.toString();
      const { lost } = checkSkips(freshGame, currentPlayerId);

      if (lost) {
        const winnerId = freshGame.players.find((p) => p.toString() !== currentPlayerId);
        markGameAsFinished(freshGame, {
          winnerId,
          endReason: 'timeout',
          finishedBy: currentPlayerId,
        });
        const eloChanges = await applyRankedEloIfNeeded(freshGame);
        await freshGame.save();

        await closeRoomAfterGame(io, freshGame.roomId);

        for (const pid of freshGame.players) {
          emitToUser(
            io,
            connectedUsers,
            pid.toString(),
            'game_over',
            buildGameOverPayload({ game: freshGame, winnerId, eloChanges })
          );
        }
        return;
      }

      const nextPlayerId = endTurn(freshGame, currentPlayerId);
      tickCooldowns(freshGame, nextPlayerId);
      await freshGame.save();

      const freshRoom = await Room.findById(freshGame.roomId);

      emitTurnUpdateToPlayers(io, connectedUsers, freshGame, nextPlayerId);

      scheduleTurnTimer(io, connectedUsers, turnTimers, freshGame, freshRoom);
    } catch (err) {
      console.error('Turn timer error:', err);
    }
  }, timeLimit);

  turnTimers.set(gameId, timer);
}

async function startGameForRoom(io, room, connectedUsers, turnTimers) {
  const roomId = room._id.toString();
  const roomFleets = stagedFleets.get(roomId);

  if (!roomFleets) {
    return { started: false, message: 'No staged fleets found for this room' };
  }

  const allSubmitted = room.players.every((p) => roomFleets.has(getPlayerUserId(p)));
  if (!allSubmitted) {
    return { started: false, message: 'All players must submit fleets before starting' };
  }

  let templateTiles = null;
  if (room.settings.boardTemplateId) {
    const tmpl = await BoardTemplate.findById(room.settings.boardTemplateId);
    if (tmpl) templateTiles = tmpl.tiles;
  }

  const playerFleets = new Map(roomFleets);
  stagedFleets.delete(roomId);

  const game = await initGame(room, playerFleets, templateTiles);
  tickCooldowns(game, game.turn.toString());
  await game.save();

  room.status = 'in_game';
  room.gameId = game._id;
  await room.save();

  for (const player of room.players) {
    const pid = getPlayerUserId(player);
    const playerView = getPlayerView(game, pid);
    emitToUser(io, connectedUsers, pid, 'game_start', {
      ...getPlayerGamePayload(game, pid),
      boards: playerView,
    });
  }

  scheduleTurnTimer(io, connectedUsers, turnTimers, game, room);

  return { started: true, game };
}

function registerGameHandlers(io, socket, connectedUsers, turnTimers) {
  const userId = socket.user._id.toString();

  // place_fleet: player submits their fleet placement during setup
  socket.on('place_fleet', async ({ roomId, fleet } = {}) => {
    try {
      if (!roomId || !Array.isArray(fleet)) {
        return socket.emit('error', { message: 'roomId and fleet are required' });
      }

      const room = await Room.findById(roomId);
      if (!room) return socket.emit('error', { message: 'Room not found' });
      await ensureUniqueRoomPlayers(room);

      const isPlayer = room.players.some((p) => getPlayerUserId(p) === userId);
      if (!isPlayer) return socket.emit('error', { message: 'Not in this room' });

      if (room.status !== 'setup' && room.status !== 'waiting') {
        return socket.emit('error', { message: 'Room is not in setup phase' });
      }
      if (fleet.length !== (room.settings.shipLimit || 5)) {
        return socket.emit('error', {
          message: `You must place exactly ${room.settings.shipLimit || 5} ships`,
        });
      }

      // Resolve ship templates and validate
      const resolvedFleet = [];
      for (const item of fleet) {
        const ship = await ShipTemplate.findOne({ _id: item.shipTemplateId, ownerId: userId });
        if (!ship) {
          return socket.emit('error', { message: `Ship template ${item.shipTemplateId} not found in your collection` });
        }
        resolvedFleet.push({
          shipTemplateId: ship._id,
          name: ship.name || `Statek ${resolvedFleet.length + 1}`,
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
       }
       const player = room.players.find((p) => getPlayerUserId(p) === userId);
       if (player) player.ready = true;
       await room.save();

       await room.populate('hostId', 'email username');
       await room.populate('players.userId', 'email username');

       socket.emit('fleet_accepted', { message: 'Fleet placement accepted' });

       // Include staged fleets in room update for all players to see fleet status
       const roomFleets = stagedFleets.get(roomId) || new Map();
       const fleetsData = Object.fromEntries(
         Array.from(roomFleets.entries()).map(([uid, fleet]) => [uid, fleet])
       );

       io.to(`room:${roomId}`).emit('room_update', {
         ...room.toObject(),
         hasPassword: !!room.settings.password,
         settings: { ...room.settings.toObject(), password: undefined },
         stagedFleets: fleetsData,
       });
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
        markGameAsFinished(game, {
          winnerId,
          endReason: 'win',
          finishedBy: userId,
        });
        const eloChanges = await applyRankedEloIfNeeded(game);
        await game.save();

        await closeRoomAfterGame(io, game.roomId);
        clearTurnTimer(turnTimers, gameId);

        for (const pid of game.players) {
          const pidStr = pid.toString();
          emitToUser(io, connectedUsers, pid.toString(), 'move_result', {
            playerId: userId,
            x,
            y,
            hit: result.hit,
            sunk: result.sunk,
            shipIndex: result.shipIndex,
            sunkPositions: result.sunkPositions || [],
            boards: getPlayerView(game, pidStr),
            fleet: game.fleets.get(pidStr) || [],
          });
          emitToUser(
            io,
            connectedUsers,
            pid.toString(),
            'game_over',
            buildGameOverPayload({ game, winnerId, eloChanges })
          );
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
          const pidStr = pid.toString();
          emitToUser(io, connectedUsers, pid.toString(), 'move_result', {
            playerId: userId,
            x,
            y,
            hit: false,
            sunk: false,
            sunkPositions: [],
            boards: getPlayerView(game, pidStr),
            fleet: game.fleets.get(pidStr) || [],
          });
        }

        emitTurnUpdateToPlayers(io, connectedUsers, game, nextPlayerId);

        clearTurnTimer(turnTimers, gameId);
        scheduleTurnTimer(io, connectedUsers, turnTimers, game, room);
      } else {
        // Hit: switch turn (1 shot per turn regardless of hit or miss)
        const nextPlayerId = endTurn(game, userId);
        tickCooldowns(game, nextPlayerId);
        await game.save();

        const room = await Room.findById(game.roomId);

        for (const pid of game.players) {
          const pidStr = pid.toString();
          emitToUser(io, connectedUsers, pid.toString(), 'move_result', {
            playerId: userId,
            x,
            y,
            hit: true,
            sunk: result.sunk,
            shipIndex: result.shipIndex,
            sunkPositions: result.sunkPositions || [],
            boards: getPlayerView(game, pidStr),
            fleet: game.fleets.get(pidStr) || [],
          });
        }

        emitTurnUpdateToPlayers(io, connectedUsers, game, nextPlayerId);

        clearTurnTimer(turnTimers, gameId);
        scheduleTurnTimer(io, connectedUsers, turnTimers, game, room);
      }
    } catch (err) {
      console.error('make_move error:', err);
      socket.emit('error', { message: 'Failed to process move' });
    }
  });

  // use_ability
  socket.on('use_ability', async ({ gameId, shipIndex, targets, orientation } = {}) => {
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
          results = useLinearShot(game, userId, shipIndex, targets?.[0], orientation);
          break;
        case 'random':
          results = useRandomShot(game, userId, shipIndex);
          break;
        case 'target':
          results = useTargetShot(game, userId, shipIndex, targets);
          break;
        case 'scout_rocket':
          results = useScoutRocket(game, userId, shipIndex, targets?.[0]);
          break;
        case 'holy_bomb':
          results = useHolyBomb(game, userId, shipIndex, targets?.[0]);
          break;
        case 'sonar': {
          const sonarResult = useSonar(game, userId, shipIndex, targets?.[0]);
          const nextPlayerId = endTurn(game, userId);
          tickCooldowns(game, nextPlayerId);
          await game.save();
          const room = await Room.findById(game.roomId);
          clearTurnTimer(turnTimers, gameId);
          scheduleTurnTimer(io, connectedUsers, turnTimers, game, room);

          socket.emit('sonar_result', {
            ...sonarResult,
            positions: sonarResult.positions || [],
            fleet: game.fleets.get(userId) || [],
          });

          for (const pid of game.players) {
            const pidStr = pid.toString();
            emitToUser(io, connectedUsers, pidStr, 'ability_result', {
              abilityType: 'sonar',
              results: [],
              shipIndex,
              playerId: userId,
              origin: sonarResult.origin || null,
              foundCount: Array.isArray(sonarResult.positions) ? sonarResult.positions.length : 0,
              positions: sonarResult.positions || [],
              boards: getPlayerView(game, pidStr),
              fleet: game.fleets.get(pidStr) || [],
            });
          }

          emitTurnUpdateToPlayers(io, connectedUsers, game, nextPlayerId);
          return;
        }
        default:
          return socket.emit('error', { message: 'Unknown ability type' });
      }

      const winnerId = checkWinCondition(game);
      const detectedPositions = Array.isArray(results)
        ? Array.from(
            new Map(
              results
                .flatMap((shot) => Array.isArray(shot?.detectedPositions) ? shot.detectedPositions : [])
                .filter((pos) => Number.isInteger(pos?.x) && Number.isInteger(pos?.y))
                .map((pos) => [`${pos.x}:${pos.y}`, { x: pos.x, y: pos.y }])
            ).values()
          )
        : [];

      if (winnerId) {
        markGameAsFinished(game, {
          winnerId,
          endReason: 'win',
          finishedBy: userId,
        });
        const eloChanges = await applyRankedEloIfNeeded(game);
        await game.save();
        await closeRoomAfterGame(io, game.roomId);
        clearTurnTimer(turnTimers, gameId);

        for (const pid of game.players) {
          const pidStr = pid.toString();
          emitToUser(io, connectedUsers, pid.toString(), 'ability_result', {
            abilityType: ship.abilityType,
            results,
            detectedPositions,
            shipIndex,
            playerId: userId,
            boards: getPlayerView(game, pidStr),
            fleet: game.fleets.get(pidStr) || [],
          });
          emitToUser(
            io,
            connectedUsers,
            pid.toString(),
            'game_over',
            buildGameOverPayload({ game, winnerId, eloChanges })
          );
        }
        return;
      }

      const room = await Room.findById(game.roomId);
      clearTurnTimer(turnTimers, gameId);
      const nextPlayerId = endTurn(game, userId);
      tickCooldowns(game, nextPlayerId);
      await game.save();
      scheduleTurnTimer(io, connectedUsers, turnTimers, game, room);

      for (const pid of game.players) {
        const pidStr = pid.toString();
        emitToUser(io, connectedUsers, pid.toString(), 'ability_result', {
          abilityType: ship.abilityType,
          results,
          detectedPositions,
          shipIndex,
          playerId: userId,
          boards: getPlayerView(game, pidStr),
          fleet: game.fleets.get(pidStr) || [],
        });
      }
      emitTurnUpdateToPlayers(io, connectedUsers, game, nextPlayerId);
    } catch (err) {
      console.error('use_ability error:', err);
      socket.emit('error', { message: err.message || 'Failed to use ability' });
    }
  });

  // surrender: player gives up, opponent wins
  socket.on('surrender', async ({ gameId } = {}) => {
    try {
      if (!gameId) return socket.emit('error', { message: 'gameId is required' });

      const game = await Game.findById(gameId);
      if (!game) return socket.emit('error', { message: 'Game not found' });
      if (game.status !== 'in_game') return socket.emit('error', { message: 'Game is not active' });

      const isPlayer = game.players.some(p => p.toString() === userId);
      if (!isPlayer) return socket.emit('error', { message: 'Not a player in this game' });

      const winnerId = game.players.find(p => p.toString() !== userId);
      markGameAsFinished(game, {
        winnerId,
        endReason: 'surrender',
        finishedBy: userId,
      });
      const eloChanges = await applyRankedEloIfNeeded(game);
      await game.save();

      clearTurnTimer(turnTimers, gameId);
      await closeRoomAfterGame(io, game.roomId);

      for (const pid of game.players) {
        emitToUser(
          io,
          connectedUsers,
          pid.toString(),
          'game_over',
          buildGameOverPayload({ game, winnerId, surrenderedBy: userId, eloChanges })
        );
      }
    } catch (err) {
      console.error('surrender error:', err);
      socket.emit('error', { message: 'Failed to surrender' });
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

      socket.emit('game_state', getPlayerGamePayload(game, userId));
    } catch (err) {
      console.error('reconnect_game error:', err);
      socket.emit('error', { message: 'Failed to reconnect to game' });
    }
  });
}

module.exports = { registerGameHandlers, startGameForRoom };
