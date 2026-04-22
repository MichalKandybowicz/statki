import { useState, useEffect, useRef, useCallback } from 'react'
import { rotateShape, getShipCells, canPlaceShip } from '../../utils/boardUtils.js'
import ShipSelector from './ShipSelector.jsx'

const TILE_SIZE = 30

function applyRotations(shape, times) {
  let s = shape
  for (let i = 0; i < times; i++) s = rotateShape(s)
  return s
}

/** Rebuild full board from base tiles + all placed ships */
function buildBoard(baseTiles, placedShips) {
  const board = baseTiles.map(r => [...r])
  for (const ps of placedShips) {
    for (const { r, c } of ps.cells) {
      board[r][c] = 'ship'
    }
  }
  return board
}

function tileColor(tile) {
  switch (tile) {
    case 'rock':  return '#6b7280'
    case 'ship':  return '#2563eb'
    default:       return '#1a3a5c'
  }
}

export default function FleetPlacer({ boardSize, boardTiles, availableShips, shipLimit = 5, onFleetReady, initialFleet = [] }) {
  // Base board (rocks from template, no ships)
  const [baseTiles, setBaseTiles] = useState(() => boardTiles?.map(r => [...r]) || [])
  const [placedShips, setPlacedShips] = useState(() => initialFleet.length > 0 ? initialFleet : [])
  const [selectedShip, setSelectedShip] = useState(null)
  const [rotation, setRotation] = useState(0)
  const [hoverCell, setHoverCell] = useState(null)
  const isDragging = useRef(false)

  useEffect(() => {
    if (boardTiles) setBaseTiles(boardTiles.map(r => [...r]))
  }, [boardTiles])

  // Synchronize initialFleet when it changes (e.g., after getting it from server)
  useEffect(() => {
    if (initialFleet.length > 0) {
      setPlacedShips(initialFleet)
    }
  }, [initialFleet])

  // R key: rotate selected/dragged ship
  useEffect(() => {
    function onKey(e) {
      if ((e.key === 'r' || e.key === 'R') && selectedShip) {
        setRotation(prev => (prev + 1) % 4)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedShip])

  const currentBoard = buildBoard(baseTiles, placedShips)

  const getPreview = useCallback((row, col) => {
    if (!selectedShip || row == null) return null
    const shape = applyRotations(selectedShip.shape, rotation)
    const cells = getShipCells(shape).map(({ r: dr, c: dc }) => ({ r: row + dr, c: col + dc }))
    const valid = canPlaceShip(currentBoard, cells, boardSize)
    return { cells, valid }
  }, [selectedShip, rotation, currentBoard, boardSize])

  const preview = hoverCell ? getPreview(hoverCell.r, hoverCell.c) : null

  function placeShip(row, col) {
    if (!selectedShip) return
    if (placedShips.length >= shipLimit) return
    const shape = applyRotations(selectedShip.shape, rotation)
    const cells = getShipCells(shape).map(({ r: dr, c: dc }) => ({ r: row + dr, c: col + dc }))
    if (!canPlaceShip(currentBoard, cells, boardSize)) return
    setPlacedShips(prev => [...prev, {
      shipTemplateId: selectedShip._id || selectedShip.id,
      cells,
    }])
    setSelectedShip(null)
    setHoverCell(null)
    isDragging.current = false
  }

  function handleCellClick(r, c) {
    if (isDragging.current) return
    if (selectedShip) {
      placeShip(r, c)
    } else {
      // Click existing ship to remove it
      const idx = placedShips.findIndex(ps => ps.cells.some(cell => cell.r === r && cell.c === c))
      if (idx >= 0) {
        setPlacedShips(prev => prev.filter((_, i) => i !== idx))
      }
    }
  }

  // ── Drag from ShipSelector ───────────────────────────────────────────────
  function handleShipDragStart(ship) {
    isDragging.current = true
    setSelectedShip(ship)
  }

  function handleCellDragOver(e, r, c) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setHoverCell({ r, c })
  }

  function handleCellDrop(e, r, c) {
    e.preventDefault()
    isDragging.current = false
    placeShip(r, c)
  }

  function handleBoardDragLeave(e) {
    // only clear when leaving the whole board container
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setHoverCell(null)
    }
  }

  // ── Cell visual ──────────────────────────────────────────────────────────
  function cellStyle(r, c) {
    const tile = currentBoard[r]?.[c]
    let bg = tileColor(tile)
    let border = '1px solid rgba(255,255,255,0.05)'

    if (preview) {
      const inPreview = preview.cells.some(p => p.r === r && p.c === c)
      if (inPreview) {
        bg = preview.valid ? 'rgba(34,197,94,0.55)' : 'rgba(239,68,68,0.55)'
        border = preview.valid ? '1px solid #4ade80' : '1px solid #f87171'
      }
    }

    return {
      width: `${TILE_SIZE}px`, height: `${TILE_SIZE}px`,
      background: bg, border,
      cursor: selectedShip ? 'crosshair' : (tile === 'ship' ? 'pointer' : 'default'),
      boxSizing: 'border-box',
    }
  }

  function handleReady() {
    const fleet = placedShips.map(ps => ({
      shipTemplateId: ps.shipTemplateId,
      positions: ps.cells.map(({ r, c }) => ({ x: c, y: r })),
    }))
    onFleetReady(fleet)
  }

  const labelW = TILE_SIZE

  return (
    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <ShipSelector
        ships={availableShips}
        onSelect={ship => { setSelectedShip(ship); setHoverCell(null) }}
        selectedShip={selectedShip}
        onDragStart={handleShipDragStart}
      />

      <div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => selectedShip && setRotation(r => (r + 1) % 4)}
            disabled={!selectedShip}
            style={{ ...rotateBtnStyle, opacity: selectedShip ? 1 : 0.4 }}
          >
            ↻ Rotate (R)
          </button>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
            {selectedShip
              ? `Układasz statek (obrót: ${rotation * 90}°) — przeciągnij lub kliknij planszę`
              : `Wybierz statek z listy lub przeciągnij na planszę; kliknij statek żeby go usunąć. Limit: ${shipLimit}`}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'inline-block' }}>
            {/* Column headers */}
            <div style={{ display: 'flex', marginLeft: `${labelW}px` }}>
              {Array.from({ length: boardSize }).map((_, c) => (
                <div key={c} style={{ width: `${TILE_SIZE}px`, height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.6rem' }}>
                  {c + 1}
                </div>
              ))}
            </div>

            {/* Board grid */}
            <div onDragLeave={handleBoardDragLeave}>
              {currentBoard.map((row, r) => (
                <div key={r} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: `${labelW}px`, textAlign: 'center', color: '#475569', fontSize: '0.6rem', flexShrink: 0 }}>
                    {String.fromCharCode(65 + r)}
                  </div>
                  {row.map((_, c) => (
                    <div
                      key={c}
                      style={cellStyle(r, c)}
                      onClick={() => handleCellClick(r, c)}
                      onMouseEnter={() => !isDragging.current && selectedShip && setHoverCell({ r, c })}
                      onMouseLeave={() => !isDragging.current && setHoverCell(null)}
                      onDragOver={e => handleCellDragOver(e, r, c)}
                      onDrop={e => handleCellDrop(e, r, c)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{placedShips.length}/{shipLimit} statek/statków ustawionych</span>
          {placedShips.length === shipLimit && !selectedShip && (
            <button onClick={handleReady} style={readyBtnStyle}>✓ Gotowy!</button>
          )}
        </div>
      </div>
    </div>
  )
}

const rotateBtnStyle = {
  background: 'rgba(37,99,235,0.15)', color: '#60a5fa',
  border: '1px solid rgba(37,99,235,0.25)', borderRadius: '6px',
  padding: '6px 12px', cursor: 'pointer', fontSize: '0.82rem',
}

const readyBtnStyle = {
  background: '#16a34a', color: 'white', border: 'none',
  borderRadius: '7px', padding: '8px 20px', fontWeight: '700',
  cursor: 'pointer', fontSize: '0.9rem',
}
