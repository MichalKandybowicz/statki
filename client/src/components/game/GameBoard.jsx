function getTileColor(tile, isOwnBoard) {
  switch (tile) {
    case 'rock': return '#6b7280'
    case 'ship': return isOwnBoard ? '#2563eb' : '#1a3a5c'
    case 'hit': return '#f59e0b'
    case 'miss': return '#0a1f33'
    case 'sunk': return '#ef4444'
    default: return '#1a3a5c'
  }
}

export default function GameBoard({ tiles, isOwnBoard, onTileClick, boardSize, sonarPositions }) {
  if (!tiles || !boardSize) return <div style={{ color: '#64748b', padding: '20px' }}>Loading board…</div>

  const tileSize = Math.max(18, Math.min(38, Math.floor(480 / boardSize)))
  const labelW = tileSize

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-block' }}>
        <div style={{ display: 'flex', marginLeft: `${labelW}px` }}>
          {Array.from({ length: boardSize }).map((_, c) => (
            <div key={c} style={{ width: `${tileSize}px`, height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.6rem' }}>
              {c + 1}
            </div>
          ))}
        </div>
        {tiles.map((row, r) => (
          <div key={r} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: `${labelW}px`, textAlign: 'center', color: '#475569', fontSize: '0.6rem', flexShrink: 0 }}>
              {String.fromCharCode(65 + r)}
            </div>
            {row.map((tile, c) => {
              const isSonar = sonarPositions?.some(p => p.x === c && p.y === r)
              const displayTile = (!isOwnBoard && tile === 'ship') ? 'water' : tile
              const bg = isSonar ? '#14532d' : getTileColor(displayTile, isOwnBoard)
              const canClick = !isOwnBoard && (displayTile === 'water' || displayTile === 'rock')
              return (
                <div
                  key={c}
                  onClick={canClick ? () => onTileClick?.(c, r) : undefined}
                  style={{
                    width: `${tileSize}px`,
                    height: `${tileSize}px`,
                    background: bg,
                    border: isSonar ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.05)',
                    cursor: canClick ? 'crosshair' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxSizing: 'border-box',
                    fontSize: `${tileSize * 0.5}px`,
                    position: 'relative',
                  }}
                >
                  {displayTile === 'miss' && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />}
                  {(displayTile === 'hit' || displayTile === 'sunk') && '💥'}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
