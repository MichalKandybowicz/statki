import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { rotateShape, getShipCells, canPlaceShip, trimShapeToBoundingBox } from '../../utils/boardUtils.js'
import ShipSelector from './ShipSelector.jsx'

const TILE_SIZE = 34

function applyRotations(shape, times) {
  let s = trimShapeToBoundingBox(shape)
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
    case 'rock': return '#64748b'
    case 'ship': return '#2563eb'
    default: return '#17324e'
  }
}

export default function FleetPlacer({
  boardSize,
  boardTiles,
  availableShips,
  shipLimit = 5,
  onFleetReady,
  initialFleet = [],
  onFleetChange,
  sidePanel = null,
}) {
  const [baseTiles, setBaseTiles] = useState(() => boardTiles?.map(r => [...r]) || [])
  const [placedShips, setPlacedShips] = useState(() => initialFleet.length > 0 ? initialFleet : [])
  const [selectedShip, setSelectedShip] = useState(null)
  const [rotation, setRotation] = useState(0)
  const [hoverCell, setHoverCell] = useState(null)
  const [initialFleetUsed, setInitialFleetUsed] = useState(false)
  const [feedback, setFeedback] = useState('Przeciagnij statek na plansze')
  const [feedbackType, setFeedbackType] = useState('hint')
  const [recentPlacement, setRecentPlacement] = useState([])
  const isDragging = useRef(false)

  useEffect(() => {
    if (boardTiles) setBaseTiles(boardTiles.map(r => [...r]))
  }, [boardTiles])

  useEffect(() => {
    if (!initialFleetUsed && initialFleet.length > 0) {
      setPlacedShips(initialFleet)
      setInitialFleetUsed(true)
    }
  }, [])

  useEffect(() => {
    onFleetChange?.(placedShips)
  }, [placedShips, onFleetChange])

  useEffect(() => {
    if (!selectedShip) return
    const selectedId = String(selectedShip._id || selectedShip.id)
    const stillAvailable = (availableShips || []).some((ship) => String(ship._id || ship.id) === selectedId)
    if (!stillAvailable) {
      setSelectedShip(null)
      setHoverCell(null)
      isDragging.current = false
    }
  }, [availableShips, selectedShip])

  useEffect(() => {
    function onKey(e) {
      if ((e.key === 'r' || e.key === 'R') && selectedShip) {
        setRotation(prev => (prev + 1) % 4)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedShip])

  useEffect(() => {
    if (!recentPlacement.length) return
    const tid = setTimeout(() => setRecentPlacement([]), 260)
    return () => clearTimeout(tid)
  }, [recentPlacement])

  const currentBoard = buildBoard(baseTiles, placedShips)

  const placedShipTemplateIds = useMemo(
    () => new Set(placedShips.map((ps) => String(ps.shipTemplateId))),
    [placedShips]
  )

  const getPreview = useCallback((row, col) => {
    if (!selectedShip || row == null) return null
    const shape = applyRotations(selectedShip.shape, rotation)
    const cells = getShipCells(shape).map(({ r: dr, c: dc }) => ({ r: row + dr, c: col + dc }))
    const valid = canPlaceShip(currentBoard, cells, boardSize)
    return { cells, valid }
  }, [selectedShip, rotation, currentBoard, boardSize])

  const preview = hoverCell ? getPreview(hoverCell.r, hoverCell.c) : null

  function flashError(message) {
    setFeedback(message)
    setFeedbackType('error')
  }

  function flashHint(message) {
    setFeedback(message)
    setFeedbackType('hint')
  }

  function placeShip(row, col) {
    if (!selectedShip) return
    if (placedShips.length >= shipLimit) {
      flashError(`Osiagnieto limit statkow (${shipLimit})`)
      return
    }

    const selectedId = String(selectedShip._id || selectedShip.id)
    if (placedShipTemplateIds.has(selectedId)) {
      flashError('Ten statek jest juz ustawiony')
      return
    }

    const shape = applyRotations(selectedShip.shape, rotation)
    const cells = getShipCells(shape).map(({ r: dr, c: dc }) => ({ r: row + dr, c: col + dc }))
    if (!canPlaceShip(currentBoard, cells, boardSize)) {
      flashError('Nie mozna ustawic statku w tym miejscu')
      return
    }

    setPlacedShips(prev => [...prev, {
      shipTemplateId: selectedShip._id || selectedShip.id,
      cells,
    }])
    setRecentPlacement(cells)
    setSelectedShip(null)
    setHoverCell(null)
    isDragging.current = false
    setRotation(0)
    flashHint('Statek ustawiony')
  }

  function handleCellClick(r, c) {
    if (isDragging.current) return
    if (selectedShip) {
      placeShip(r, c)
    } else {
      const idx = placedShips.findIndex(ps => ps.cells.some(cell => cell.r === r && cell.c === c))
      if (idx >= 0) {
        setPlacedShips(prev => prev.filter((_, i) => i !== idx))
        flashHint('Statek usuniety z planszy')
      }
    }
  }

  function handleShipDragStart(ship) {
    if (!ship) return
    isDragging.current = true
    setSelectedShip(ship)
    flashHint('Upusc statek na planszy')
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

  function handleShipDragEnd() {
    isDragging.current = false
  }

  function handleBoardDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setHoverCell(null)
    }
  }

  function rotateSelectedShip() {
    if (!selectedShip) return
    setRotation(r => (r + 1) % 4)
    flashHint('Obrot statku')
  }

  function handleBoardWheel(e) {
    if (!selectedShip) return
    e.preventDefault()
    setRotation((prev) => (prev + (e.deltaY > 0 ? 1 : 3)) % 4)
  }

  function clearBoard() {
    setPlacedShips([])
    setSelectedShip(null)
    setHoverCell(null)
    setRotation(0)
    flashHint('Plansza wyczyszczona')
  }

  function randomizeFleet() {
    const uniqueShips = (availableShips || []).filter((ship) => {
      const id = String(ship._id || ship.id)
      return id
    }).slice(0, shipLimit)

    if (uniqueShips.length === 0) {
      flashError('Brak statkow do losowania')
      return
    }

    const shuffled = [...uniqueShips].sort(() => Math.random() - 0.5)
    const drafted = []

    for (const ship of shuffled) {
      let placed = false
      for (let i = 0; i < 220 && !placed; i++) {
        const randomRotation = Math.floor(Math.random() * 4)
        const shape = applyRotations(ship.shape, randomRotation)
        const row = Math.floor(Math.random() * boardSize)
        const col = Math.floor(Math.random() * boardSize)
        const cells = getShipCells(shape).map(({ r: dr, c: dc }) => ({ r: row + dr, c: col + dc }))
        const boardDraft = buildBoard(baseTiles, drafted)
        if (!canPlaceShip(boardDraft, cells, boardSize)) continue
        drafted.push({ shipTemplateId: ship._id || ship.id, cells })
        placed = true
      }
    }

    setPlacedShips(drafted)
    setSelectedShip(null)
    setHoverCell(null)
    setRotation(0)
    if (drafted.length === shipLimit) {
      flashHint('Losowe ustawienie gotowe')
    } else {
      flashError(`Ustawiono ${drafted.length}/${shipLimit}. Sprobuj ponownie lub dostosuj recznie.`)
    }
  }

  function cellStyle(r, c) {
    const tile = currentBoard[r]?.[c]
    let bg = tileColor(tile)
    let border = '1px solid rgba(255,255,255,0.07)'
    let transform = 'scale(1)'

    if (preview) {
      const inPreview = preview.cells.some(p => p.r === r && p.c === c)
      if (inPreview) {
        bg = preview.valid ? 'rgba(34,197,94,0.55)' : 'rgba(239,68,68,0.55)'
        border = preview.valid ? '1px solid #4ade80' : '1px solid #f87171'
      }
    }

    const isRecent = recentPlacement.some((p) => p.r === r && p.c === c)
    if (isRecent) {
      transform = 'scale(1.05)'
      border = '1px solid rgba(147,197,253,0.9)'
    }

    return {
      width: `${TILE_SIZE}px`,
      height: `${TILE_SIZE}px`,
      background: bg,
      border,
      cursor: selectedShip ? 'crosshair' : (tile === 'ship' ? 'pointer' : 'default'),
      boxSizing: 'border-box',
      transition: 'background 140ms ease, border 140ms ease, transform 140ms ease',
      transform,
    }
  }

  function handleReady() {
    if (placedShips.length !== shipLimit) {
      flashError(`Musisz ustawic ${shipLimit} statkow`)
      return
    }
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
        onSelect={ship => { setSelectedShip(ship); setHoverCell(null); setFeedback('Przeciagnij statek na plansze') }}
        selectedShip={selectedShip}
        onDragStart={handleShipDragStart}
        onDragEnd={handleShipDragEnd}
        placedShipIds={placedShipTemplateIds}
      />

      <div style={{ flex: '1 1 480px', minWidth: '340px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
          <button onClick={rotateSelectedShip} disabled={!selectedShip} style={{ ...actionBtnStyle, opacity: selectedShip ? 1 : 0.45 }}>
            Rotate (R)
          </button>
          <button onClick={randomizeFleet} style={actionBtnStyle}>Losuj</button>
          <button onClick={clearBoard} style={actionBtnMutedStyle}>Wyczysc</button>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            {selectedShip
              ? `Wybrany: ${selectedShip.name || 'statek'} | obrot ${rotation * 90}°`
              : 'Wybierz statek i przeciagnij go na plansze'}
          </span>
        </div>

        <div
          style={{
            marginBottom: '10px',
            background: feedbackType === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(37,99,235,0.1)',
            border: feedbackType === 'error' ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(37,99,235,0.35)',
            color: feedbackType === 'error' ? '#fca5a5' : '#93c5fd',
            borderRadius: '8px',
            padding: '8px 10px',
            fontSize: '0.78rem',
          }}
        >
          {feedback}
        </div>

        <div
          style={{ overflowX: 'auto', background: '#102236', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px' }}
          onWheel={handleBoardWheel}
        >
          <div style={{ display: 'inline-block' }}>
            <div style={{ display: 'flex', marginLeft: `${labelW}px` }}>
              {Array.from({ length: boardSize }).map((_, c) => (
                <div key={c} style={{ width: `${TILE_SIZE}px`, height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.62rem' }}>
                  {c + 1}
                </div>
              ))}
            </div>

            <div onDragLeave={handleBoardDragLeave}>
              {currentBoard.map((row, r) => (
                <div key={r} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: `${labelW}px`, textAlign: 'center', color: '#64748b', fontSize: '0.62rem', flexShrink: 0 }}>
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

        <div style={{ marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{placedShips.length}/{shipLimit} statkow ustawionych</span>
          <button
            onClick={handleReady}
            disabled={placedShips.length !== shipLimit}
            style={{ ...readyBtnStyle, opacity: placedShips.length === shipLimit ? 1 : 0.45, cursor: placedShips.length === shipLimit ? 'pointer' : 'not-allowed' }}
          >
            ✓ Gotowy
          </button>
        </div>

        {sidePanel && (
          <div style={{ marginTop: '14px' }}>
            {sidePanel}
          </div>
        )}
      </div>
    </div>
  )
}

const actionBtnStyle = {
  background: 'rgba(37,99,235,0.16)',
  color: '#93c5fd',
  border: '1px solid rgba(37,99,235,0.35)',
  borderRadius: '6px',
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontWeight: 600,
}

const actionBtnMutedStyle = {
  background: 'rgba(255,255,255,0.06)',
  color: '#cbd5e1',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '6px',
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontWeight: 600,
}

const readyBtnStyle = {
  background: '#16a34a',
  color: 'white',
  border: 'none',
  borderRadius: '7px',
  padding: '8px 20px',
  fontWeight: '700',
  fontSize: '0.88rem',
}
