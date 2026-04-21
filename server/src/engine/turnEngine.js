/**
 * Turn Engine - manages turn lifecycle and skip/timeout logic.
 */

const SKIP_LIMIT = 3;

/**
 * Starts a player's turn: records start time and ticks cooldowns.
 * @param {object} game - Mongoose Game document
 * @param {string} playerId
 */
function startTurn(game, playerId) {
  game.turn = playerId;
  game.turnStartedAt = new Date();
  game.markModified('turn');
  game.markModified('turnStartedAt');
}

/**
 * Ends a player's turn: switches to the next player.
 * @param {object} game - Mongoose Game document
 * @param {string} playerId
 * @returns {string} nextPlayerId
 */
function endTurn(game, playerId) {
  const nextPlayer = game.players.find((p) => p.toString() !== playerId.toString());
  if (!nextPlayer) throw new Error('Next player not found');

  game.turn = nextPlayer;
  game.turnStartedAt = new Date();
  game.lastActionAt = new Date();
  game.markModified('turn');
  game.markModified('turnStartedAt');
  game.markModified('lastActionAt');

  return nextPlayer.toString();
}

/**
 * Increments skip count for a player and checks if they have lost.
 * @param {object} game - Mongoose Game document
 * @param {string} playerId
 * @returns {{ skips: number, lost: boolean }}
 */
function checkSkips(game, playerId) {
  const current = game.skips.get(playerId.toString()) || 0;
  const newCount = current + 1;
  game.skips.set(playerId.toString(), newCount);
  game.markModified('skips');

  return { skips: newCount, lost: newCount >= SKIP_LIMIT };
}

/**
 * Determines if the current turn has timed out.
 * @param {object} game
 * @param {number} timeLimitSeconds
 * @returns {boolean}
 */
function isTurnTimedOut(game, timeLimitSeconds) {
  if (!game.turnStartedAt) return false;
  const elapsed = (Date.now() - new Date(game.turnStartedAt).getTime()) / 1000;
  return elapsed >= timeLimitSeconds;
}

module.exports = { startTurn, endTurn, checkSkips, isTurnTimedOut };
