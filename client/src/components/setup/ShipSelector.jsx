import ShipGrid from '../ships/ShipGrid.jsx'

export default function ShipSelector({ ships, onSelect, selectedShip, onDragStart }) {
  if (!ships || ships.length === 0) {
    return (
      <div style={{ minWidth: '160px' }}>
        <h3 style={{ color: '#e2e8f0', fontSize: '0.95rem', marginBottom: '10px' }}>Statki</h3>
        <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Brak statków. <a href="/ships">Najpierw stwórz statki.</a></p>
      </div>
    )
  }

  return (
    <div style={{ minWidth: '160px' }}>
      <h3 style={{ color: '#e2e8f0', fontSize: '0.95rem', marginBottom: '4px' }}>Wybierz statek</h3>
      <p style={{ color: '#475569', fontSize: '0.7rem', marginBottom: '10px' }}>
        Kliknij lub przeciągnij na planszę · <kbd style={kbdStyle}>R</kbd> obrót
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {ships.map(ship => {
          const id = ship._id || ship.id
          const selId = selectedShip?._id || selectedShip?.id
          const isSelected = id === selId
          const cells = ship.shape?.flat().filter(v => v === 1).length || 0
          return (
            <div
              key={id}
              draggable
              onClick={() => onSelect(isSelected ? null : ship)}
              onDragStart={e => {
                e.dataTransfer.effectAllowed = 'copy'
                // ghost image
                e.dataTransfer.setData('text/plain', id)
                onDragStart?.(ship)
              }}
              style={{
                display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '7px',
                cursor: 'grab',
                background: isSelected ? 'rgba(37,99,235,0.18)' : '#1a2940',
                border: isSelected ? '1px solid rgba(37,99,235,0.6)' : '1px solid rgba(255,255,255,0.07)',
                userSelect: 'none',
              }}
            >
              <ShipGrid shape={ship.shape} readOnly />
              <div style={{ marginLeft: '8px' }}>
                <div style={{ color: '#e2e8f0', fontSize: '0.78rem' }}>{cells} pola</div>
                <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{ship.abilityType || '—'}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const kbdStyle = {
  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '3px', padding: '1px 4px', fontSize: '0.65rem', color: '#94a3b8',
}
