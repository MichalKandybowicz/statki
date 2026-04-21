/**
 * Checks if all filled cells in a ship shape are contiguous (4-connected).
 * @param {number[][]} shape - 2D grid of 0/1
 * @returns {boolean}
 */
function isContiguous(shape) {
  const cells = [];
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c] === 1) cells.push([r, c]);
    }
  }

  if (cells.length === 0) return false;
  if (cells.length === 1) return true;

  const visited = new Set();
  const key = (r, c) => `${r},${c}`;
  const cellSet = new Set(cells.map(([r, c]) => key(r, c)));

  const queue = [cells[0]];
  visited.add(key(...cells[0]));

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    const neighbors = [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ];
    for (const [nr, nc] of neighbors) {
      const k = key(nr, nc);
      if (cellSet.has(k) && !visited.has(k)) {
        visited.add(k);
        queue.push([nr, nc]);
      }
    }
  }

  return visited.size === cells.length;
}

/**
 * Counts the number of filled cells in a shape.
 * @param {number[][]} shape
 * @returns {number}
 */
function countCells(shape) {
  let count = 0;
  for (const row of shape) {
    for (const cell of row) {
      if (cell === 1) count++;
    }
  }
  return count;
}

module.exports = { isContiguous, countCells };
