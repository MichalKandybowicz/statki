export function createEmptyBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill('water'))
}

export function rotateShape(shape) {
  const n = shape.length
  const rotated = Array.from({ length: n }, () => Array(n).fill(0))
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      rotated[c][n - 1 - r] = shape[r][c]
    }
  }
  return rotated
}

export function getShipCells(shape) {
  const cells = []
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < (shape[r]?.length || 0); c++) {
      if (shape[r][c] === 1) {
        cells.push({ r, c })
      }
    }
  }
  return cells
}

export function canPlaceShip(board, shipCells, boardSize) {
  return shipCells.every(({ r, c }) =>
    r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r]?.[c] === 'water'
  )
}

export function placeShipOnBoard(board, shipCells) {
  const newBoard = board.map(row => [...row])
  shipCells.forEach(({ r, c }) => {
    newBoard[r][c] = 'ship'
  })
  return newBoard
}

export function removeShipFromBoard(board, shipCells) {
  const newBoard = board.map(row => [...row])
  shipCells.forEach(({ r, c }) => {
    newBoard[r][c] = 'water'
  })
  return newBoard
}

export function isContiguous(shape) {
  const cells = getShipCells(shape)
  if (cells.length === 0) return false
  if (cells.length === 1) return true

  const visited = new Set()
  const queue = [cells[0]]
  visited.add(`${cells[0].r},${cells[0].c}`)
  const cellSet = new Set(cells.map(cell => `${cell.r},${cell.c}`))

  while (queue.length > 0) {
    const { r, c } = queue.shift()
    const neighbours = [
      { r: r - 1, c },
      { r: r + 1, c },
      { r, c: c - 1 },
      { r, c: c + 1 },
    ]
    for (const n of neighbours) {
      const key = `${n.r},${n.c}`
      if (cellSet.has(key) && !visited.has(key)) {
        visited.add(key)
        queue.push(n)
      }
    }
  }

  return visited.size === cells.length
}
