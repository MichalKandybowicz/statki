export default function TileEditor({ tile, onClick, size }) {
  const cellSize = size || 28
  const isRock = tile === 'rock'

  return (
    <div
      onClick={onClick}
      style={{
        width: `${cellSize}px`,
        height: `${cellSize}px`,
        background: isRock ? '#6b7280' : '#1a3a5c',
        border: '1px solid rgba(255,255,255,0.05)',
        cursor: onClick ? 'pointer' : 'default',
        boxSizing: 'border-box',
        transition: 'background 0.1s',
      }}
    />
  )
}
