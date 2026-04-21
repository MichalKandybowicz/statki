import ShipGrid from './ShipGrid.jsx'

export default function ShipCard({ ship, onDelete, onEdit }) {
  const cellCount = ship.shape?.flat().filter(v => v === 1).length || 0

  return (
    <div style={cardStyle}>
      <div style={{ flexShrink: 0 }}>
        <ShipGrid shape={ship.shape} readOnly />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingLeft: '12px' }}>
        <div style={{ color: '#e2e8f0', fontWeight: '600', fontSize: '0.9rem', marginBottom: '3px' }}>
          {cellCount} cell{cellCount !== 1 ? 's' : ''}
        </div>
        <div style={{ color: '#64748b', fontSize: '0.78rem' }}>
          Ability: <span style={{ color: '#94a3b8' }}>{ship.abilityType || '—'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {onEdit && (
          <button onClick={() => onEdit(ship)} style={editBtnStyle}>Edit</button>
        )}
        <button onClick={() => onDelete(ship._id || ship.id)} style={deleteBtnStyle}>Delete</button>
      </div>
    </div>
  )
}

const cardStyle = {
  background: '#1a2940',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  padding: '12px 14px',
  display: 'flex',
  alignItems: 'center',
}

const editBtnStyle = {
  background: 'rgba(37,99,235,0.15)',
  color: '#60a5fa',
  border: '1px solid rgba(37,99,235,0.25)',
  borderRadius: '5px',
  padding: '4px 10px',
  fontSize: '0.78rem',
  cursor: 'pointer',
}

const deleteBtnStyle = {
  background: 'rgba(239,68,68,0.1)',
  color: '#f87171',
  border: '1px solid rgba(239,68,68,0.2)',
  borderRadius: '5px',
  padding: '4px 10px',
  fontSize: '0.78rem',
  cursor: 'pointer',
}
