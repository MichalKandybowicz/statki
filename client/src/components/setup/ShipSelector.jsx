import ShipGrid from '../ships/ShipGrid.jsx'

export default function ShipSelector({ ships, onSelect, selectedShip }) {
  if (!ships || ships.length === 0) {
    return (
      <div style={{ minWidth: '160px' }}>
        <h3 style={{ color: '#e2e8f0', fontSize: '0.95rem', marginBottom: '10px' }}>Ships</h3>
        <p style={{ color: '#64748b', fontSize: '0.82rem' }}>No ships. <a href="/ships">Create ships first.</a></p>
      </div>
    )
  }

  return (
    <div style={{ minWidth: '160px' }}>
      <h3 style={{ color: '#e2e8f0', fontSize: '0.95rem', marginBottom: '10px' }}>Select Ship</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {ships.map(ship => {
          const id = ship._id || ship.id
          const selId = selectedShip?._id || selectedShip?.id
          const isSelected = id === selId
          const cells = ship.shape?.flat().filter(v => v === 1).length || 0
          return (
            <div
              key={id}
              onClick={() => onSelect(isSelected ? null : ship)}
              style={{
                display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '7px', cursor: 'pointer',
                background: isSelected ? 'rgba(37,99,235,0.15)' : '#1a2940',
                border: isSelected ? '1px solid rgba(37,99,235,0.5)' : '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <ShipGrid shape={ship.shape} readOnly />
              <div style={{ marginLeft: '8px' }}>
                <div style={{ color: '#e2e8f0', fontSize: '0.78rem' }}>{cells} cells</div>
                <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{ship.abilityType || '—'}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
