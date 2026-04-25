const Game = require('../models/Game');
const { getAbilityCooldown } = require('./abilityConfig');

const SKIP_LIMIT = 3;
const INACTIVITY_DAYS = 3;

/**
 * Builds an empty board filled with 'water' tiles.
 */
function buildEmptyBoard(size, templateTiles = null) {
  if (templateTiles) {
    return templateTiles.map((row) => [...row]);
  }
  return Array.from({ length: size }, () => Array(size).fill('water'));
}

/**
 * Initializes a new game from a room and submitted fleets.
 * @param {object} room - Mongoose room document
 * @param {Map<string, Array>} playerFleets - Map of userId -> fleet array
 * @param {string[][]|null} templateTiles
 * @returns {Promise<Game>}
 */
async function initGame(room, playerFleets, templateTiles = null) {
  const boardSize = room.settings.boardSize;
  const playerIds = room.players.map((p) => p.userId.toString());

  const boards = new Map();
  const fleets = new Map();
  const skips = new Map();

  for (const playerId of playerIds) {
    const hiddenBoard = buildEmptyBoard(boardSize, templateTiles);
    const visibleBoard = buildEmptyBoard(boardSize, templateTiles);

    const fleet = playerFleets.get(playerId) || [];
    // Mark ship positions on hidden board
    for (const ship of fleet) {
      for (const { x, y } of ship.positions) {
        hiddenBoard[y][x] = 'ship';
      }
    }

    boards.set(playerId, { hidden: hiddenBoard, visible: visibleBoard });
    fleets.set(playerId, fleet.map((s, index) => ({
      ...s,
      name: s.name || `Statek ${index + 1}`,
      abilityType: s.abilityType || null,
      hits: [],
      isSunk: false,
      cooldownRemaining: getAbilityCooldown(s.abilityType, s.positions?.length || 1),
    })));
    skips.set(playerId, 0);
  }

  // Randomly determine first player
  const firstPlayer = playerIds[Math.floor(Math.random() * playerIds.length)];

  const game = new Game({
    roomId: room._id,
    players: playerIds,
    boardSize,
    turnTimeLimit: room.settings.turnTimeLimit || 60,
    isRanked: !!room.isRanked,
    boards,
    fleets,
    turn: firstPlayer,
    skips,
    lastActionAt: new Date(),
    turnStartedAt: new Date(),
    status: 'in_game',
  });

  await game.save();
  return game;
}

/**
 * Processes a shot from a player.
 * @returns {{ hit: boolean, sunk: boolean, shipIndex?: number, alreadyShot: boolean, sunkPositions?: Array }}
 */
function processMove(game, playerId, x, y) {
  const opponentId = game.players.find((p) => p.toString() !== playerId.toString());
  if (!opponentId) throw new Error('Opponent not found');

  const opponentBoard = game.boards.get(opponentId.toString());
  if (!opponentBoard) throw new Error('Opponent board not found');

  const hidden = opponentBoard.hidden;
  const visible = opponentBoard.visible;

  const currentTile = hidden[y][x];

  if (currentTile === 'miss' || currentTile === 'hit' || currentTile === 'sunk') {
    return { hit: false, sunk: false, alreadyShot: true };
  }

  const isHit = currentTile === 'ship';

  if (isHit) {
    hidden[y][x] = 'hit';
    visible[y][x] = 'hit';

    const fleet = game.fleets.get(opponentId.toString());
    let hitShipIndex = -1;
    let isSunk = false;
      let sunkPositions = [];

    for (let i = 0; i < fleet.length; i++) {
      const ship = fleet[i];
      const isShipCell = ship.positions.some((p) => p.x === x && p.y === y);
      if (isShipCell) {
        ship.hits.push({ x, y });
        hitShipIndex = i;

        if (ship.hits.length >= ship.positions.length) {
          ship.isSunk = true;
          isSunk = true;
          sunkPositions = ship.positions.map((pos) => ({ x: pos.x, y: pos.y }));
          // Mark sunk on both boards
          for (const pos of ship.positions) {
            hidden[pos.y][pos.x] = 'sunk';
            visible[pos.y][pos.x] = 'sunk';
          }
        }
        break;
      }
    }

    game.boards.set(opponentId.toString(), opponentBoard);
    game.lastActionAt = new Date();
    game.markModified('boards');
    game.markModified('fleets');

      return { hit: true, sunk: isSunk, shipIndex: hitShipIndex, alreadyShot: false, sunkPositions };
  } else {
    hidden[y][x] = 'miss';
    visible[y][x] = 'miss';
    game.boards.set(opponentId.toString(), opponentBoard);
    game.lastActionAt = new Date();
    game.markModified('boards');

    return { hit: false, sunk: false, alreadyShot: false };
  }
}

/**
 * Checks if the game has a winner.
 * @returns {string|null} winnerId or null
 */
function checkWinCondition(game) {
  for (const [playerId, fleet] of game.fleets.entries()) {
    const allSunk = fleet.every((ship) => ship.isSunk);
    if (allSunk) {
      // The opponent wins
      const winner = game.players.find((p) => p.toString() !== playerId);
      return winner ? winner.toString() : null;
    }
  }
  return null;
}

/**
 * Returns the visible board state safe to send to a specific player.
 * Player sees their own hidden board (where their ships are) and only the
 * visible (attack result) board of the opponent.
 */
function getPlayerView(game, playerId) {
  const view = {};
  for (const [pid, boardState] of game.boards.entries()) {
    if (pid === playerId.toString()) {
      view[pid] = { board: boardState.hidden };
    } else {
      view[pid] = { board: boardState.visible };
    }
  }
  return view;
}

/**
 * Switches the active turn to the other player.
 */
function switchTurn(game) {
  const current = game.turn.toString();
  const next = game.players.find((p) => p.toString() !== current);
  game.turn = next;
  game.turnStartedAt = new Date();
  game.markModified('turn');
  return next ? next.toString() : null;
}

/**
 * Handles a turn timeout: increments skip counter for current player.
 * @returns {{ skipped: string, lost: boolean }}
 */
function handleTimeout(game) {
  const playerId = game.turn.toString();
  const current = game.skips.get(playerId) || 0;
  game.skips.set(playerId, current + 1);
  game.markModified('skips');

  const lost = current + 1 >= SKIP_LIMIT;
  return { skipped: playerId, lost };
}

/**
 * Checks if the game has been inactive for more than 3 days.
 * Returns the last-active player as winner.
 * @returns {string|null}
 */
function checkInactivity(game) {
  if (!game.lastActionAt) return null;
  const diff = Date.now() - new Date(game.lastActionAt).getTime();
  const threeDays = INACTIVITY_DAYS * 24 * 60 * 60 * 1000;
  if (diff > threeDays) {
    // The player whose turn it is NOT wins (last active player)
    const current = game.turn.toString();
    const winner = game.players.find((p) => p.toString() !== current);
    return winner ? winner.toString() : null;
  }
  return null;
}

module.exports = {
  initGame,
  processMove,
  checkWinCondition,
  getPlayerView,
  switchTurn,
  handleTimeout,
  checkInactivity,
  buildEmptyBoard,
};
