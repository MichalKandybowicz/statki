export function createEmptyBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill('water'))
}

export function rotateShape(shape) {
  const rows = shape.length
  const cols = Math.max(...shape.map(r => r.length))
  // 90° clockwise: new dimensions are cols × rows
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < (shape[r]?.length || 0); c++) {
      rotated[c][rows - 1 - r] = shape[r][c]
    }
  }
  return rotated
}

export function trimShapeToBoundingBox(shape) {
  if (!Array.isArray(shape) || shape.length === 0) return [[0]]

  let minR = Infinity
  let maxR = -1
  let minC = Infinity
  let maxC = -1

  for (let r = 0; r < shape.length; r++) {
    const row = Array.isArray(shape[r]) ? shape[r] : []
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 1) {
        if (r < minR) minR = r
        if (r > maxR) maxR = r
        if (c < minC) minC = c
        if (c > maxC) maxC = c
      }
    }
  }

  if (maxR < minR || maxC < minC) return [[0]]

  const trimmed = []
  for (let r = minR; r <= maxR; r++) {
    const srcRow = Array.isArray(shape[r]) ? shape[r] : []
    const nextRow = []
    for (let c = minC; c <= maxC; c++) {
      nextRow.push(srcRow[c] === 1 ? 1 : 0)
    }
    trimmed.push(nextRow)
  }

  return trimmed
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
