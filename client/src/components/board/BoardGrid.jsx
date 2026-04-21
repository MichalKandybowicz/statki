import TileEditor from './TileEditor.jsx'

export default function BoardGrid({ tiles, size, onToggle, readOnly }) {
  if (!tiles || !size) return null

  const cellSize = Math.max(20, Math.min(32, Math.floor(560 / size)))
  const labelW = 24

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-block' }}>
        {/* Column number headers */}
        <div style={{ display: 'flex', marginLeft: `${labelW}px` }}>
          {Array.from({ length: size }).map((_, c) => (
            <div key={c} style={{
              width: `${cellSize}px`,
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
              fontSize: '0.62rem',
            }}>
              {c + 1}
            </div>
          ))}
        </div>

        {tiles.map((row, r) => (
          <div key={r} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Row letter label */}
            <div style={{
              width: `${labelW}px`,
              textAlign: 'center',
              color: '#475569',
              fontSize: '0.62rem',
              flexShrink: 0,
            }}>
              {String.fromCharCode(65 + r)}
            </div>
            {row.map((tile, c) => (
              <TileEditor
                key={c}
                tile={tile}
                size={cellSize}
                onClick={() => !readOnly && onToggle?.(r, c)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
