/**
 * Validates a full fleet placement on the board.
 * @param {Array} fleet - Array of { shipTemplateId, positions: [{x,y}] }
 * @param {string[][]} board - 2D tile array ('water'|'rock')
 * @param {number} boardSize
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePlacement(fleet, board, boardSize) {
  if (!Array.isArray(fleet) || fleet.length === 0) {
    return { valid: false, error: 'Fleet must be a non-empty array' };
  }

  for (let i = 0; i < fleet.length; i++) {
    const ship = fleet[i];
    if (!Array.isArray(ship.positions) || ship.positions.length === 0) {
      return { valid: false, error: `Ship ${i} has no positions` };
    }

    if (!isOnBoard(ship.positions, boardSize)) {
      return { valid: false, error: `Ship ${i} is out of bounds` };
    }

    if (isOnRock(ship.positions, board)) {
      return { valid: false, error: `Ship ${i} is placed on a rock` };
    }

    for (let j = i + 1; j < fleet.length; j++) {
      if (hasOverlaps(ship.positions, fleet[j].positions)) {
        return { valid: false, error: `Ships ${i} and ${j} overlap` };
      }
    }
  }

  return { valid: true };
}

/**
 * Checks if two sets of positions overlap.
 * @param {Array<{x:number,y:number}>} positions1
 * @param {Array<{x:number,y:number}>} positions2
 * @returns {boolean}
 */
function hasOverlaps(positions1, positions2) {
  const set = new Set(positions1.map(({ x, y }) => `${x},${y}`));
  return positions2.some(({ x, y }) => set.has(`${x},${y}`));
}

/**
 * Checks if all positions are within board bounds.
 * @param {Array<{x:number,y:number}>} positions
 * @param {number} boardSize
 * @returns {boolean}
 */
function isOnBoard(positions, boardSize) {
  return positions.every(({ x, y }) => x >= 0 && x < boardSize && y >= 0 && y < boardSize);
}

/**
 * Checks if any position is on a rock tile.
 * @param {Array<{x:number,y:number}>} positions
 * @param {string[][]} board
 * @returns {boolean}
 */
function isOnRock(positions, board) {
  if (!board || board.length === 0) return false;
  return positions.some(({ x, y }) => {
    const row = board[y];
    return row && row[x] === 'rock';
  });
}

module.exports = { validatePlacement, hasOverlaps, isOnBoard, isOnRock };
