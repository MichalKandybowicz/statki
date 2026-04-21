import { useState, useEffect } from 'react'
import { rotateShape, getShipCells, canPlaceShip, placeShipOnBoard, removeShipFromBoard } from '../../utils/boardUtils.js'
import ShipSelector from './ShipSelector.jsx'

const TILE_SIZE = 30

function tileColor(tile) {
  switch (tile) {
    case 'rock': return '#6b7280'
    case 'ship': return '#2563eb'
    default: return '#1a3a5c'
  }
}

function applyRotations(shape, times) {
  let s = shape
  for (let i = 0; i < times; i++) s = rotateShape(s)
  return s
}

export default function FleetPlacer({ boardSize, boardTiles, availableShips, onFleetReady }) {
  const [currentBoard, setCurrentBoard] = useState(() => boardTiles?.map(r => [...r]) || [])
  const [placedShips, setPlacedShips] = useState([])
  const [selectedShip, setSelectedShip] = useState(null)
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    if (boardTiles) setCurrentBoard(boardTiles.map(r => [...r]))
  }, [boardTiles])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'r' || e.key === 'R') setRotation(prev => (prev + 1) % 4)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleBoardClick(r, c) {
    if (selectedShip) {
      const shape = applyRotations(selectedShip.shape, rotation)
      const cells = getShipCells(shape).map(({ r: dr, c: dc }) => ({ r: r + dr, c: c + dc }))
      if (canPlaceShip(currentBoard, cells, boardSize)) {
        setCurrentBoard(placeShipOnBoard(currentBoard, cells))
        setPlacedShips(prev => [...prev, { shipTemplateId: selectedShip._id || selectedShip.id, cells }])
        setSelectedShip(null)
      }
    } else {
      const idx = placedShips.findIndex(ps => ps.cells.some(cell => cell.r === r && cell.c === c))
      if (idx >= 0) {
        setCurrentBoard(removeShipFromBoard(currentBoard, placedShips[idx].cells))
        setPlacedShips(prev => prev.filter((_, i) => i !== idx))
      }
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
      <div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => setRotation(r => (r + 1) % 4)} style={rotateBtnStyle}>↻ Rotate (R)</button>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
            {selectedShip ? `Placing ship (rot: ${rotation * 90}°) — click board` : 'Click a ship to select, then click board'}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'inline-block' }}>
            <div style={{ display: 'flex', marginLeft: `${labelW}px` }}>
              {Array.from({ length: boardSize }).map((_, c) => (
                <div key={c} style={{ width: `${TILE_SIZE}px`, height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.6rem' }}>{c + 1}</div>
              ))}
            </div>
            {currentBoard.map((row, r) => (
              <div key={r} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: `${labelW}px`, textAlign: 'center', color: '#475569', fontSize: '0.6rem', flexShrink: 0 }}>
                  {String.fromCharCode(65 + r)}
                </div>
                {row.map((tile, c) => (
                  <div
                    key={c}
                    onClick={() => handleBoardClick(r, c)}
                    style={{
                      width: `${TILE_SIZE}px`, height: `${TILE_SIZE}px`,
                      background: tileColor(tile),
                      border: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer', boxSizing: 'border-box',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{placedShips.length} ship(s) placed</span>
          {placedShips.length > 0 && (
            <button onClick={handleReady} style={readyBtnStyle}>✓ Ready!</button>
          )}
        </div>
      </div>

      <ShipSelector ships={availableShips} onSelect={setSelectedShip} selectedShip={selectedShip} />
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
