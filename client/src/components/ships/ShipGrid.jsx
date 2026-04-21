const GRID = 4

export default function ShipGrid({ shape, onToggle, readOnly, cellSize }) {
  const size = cellSize || (readOnly ? 14 : 40)

  return (
    <div style={{ display: 'inline-block', lineHeight: 0 }}>
      {Array.from({ length: GRID }).map((_, r) => (
        <div key={r} style={{ display: 'flex' }}>
          {Array.from({ length: GRID }).map((_, c) => {
            const isShip = shape?.[r]?.[c] === 1
            return (
              <div
                key={c}
                onClick={() => !readOnly && onToggle?.(r, c)}
                title={readOnly ? undefined : `(${r},${c})`}
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  background: isShip ? '#2563eb' : '#0d1b2a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: readOnly ? 'default' : 'pointer',
                  boxSizing: 'border-box',
                  transition: 'background 0.1s',
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
