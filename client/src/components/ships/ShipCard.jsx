import ShipGrid from './ShipGrid.jsx'
import { getAbilityInfo, formatCooldownTurns } from '../../utils/abilityInfo.js'

export default function ShipCard({ ship, onDelete, onEdit, onToggleFavorite, isFavorite, onSecondaryAction, secondaryActionLabel }) {
  const cellCount = ship.shape?.flat().filter(v => v === 1).length || 0
  const ability = getAbilityInfo(ship.abilityType, ship.size || cellCount)

  return (
    <div style={cardStyle}>
      <div style={{ flexShrink: 0 }}>
        <ShipGrid shape={ship.shape} readOnly />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingLeft: '12px' }}>
        <div style={{ color: '#e2e8f0', fontWeight: '700', fontSize: '0.95rem', marginBottom: '4px' }}>
          {ship.name || 'Nienazwany statek'}
        </div>
        <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '4px' }}>
          {cellCount} pól · {ability.label}
        </div>
        <div style={{ color: '#fbbf24', fontSize: '0.74rem', marginBottom: '4px' }}>Cooldown: {formatCooldownTurns(ability.cooldown)}</div>
        <div style={{ color: '#64748b', fontSize: '0.74rem', lineHeight: 1.45 }}>
          {ability.description}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {onToggleFavorite && (
          <button onClick={() => onToggleFavorite(ship)} style={favoriteBtnStyle}>{isFavorite ? '★' : '☆'}</button>
        )}
        {onSecondaryAction && (
          <button onClick={() => onSecondaryAction(ship)} style={copyBtnStyle}>{secondaryActionLabel || 'Akcja'}</button>
        )}
        {onEdit && (
          <button onClick={() => onEdit(ship)} style={editBtnStyle}>Edytuj</button>
        )}
        {onDelete && <button onClick={() => onDelete(ship._id || ship.id)} style={deleteBtnStyle}>Usuń</button>}
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

const favoriteBtnStyle = {
  background: 'rgba(251,191,36,0.1)',
  color: '#fbbf24',
  border: '1px solid rgba(251,191,36,0.28)',
  borderRadius: '5px',
  padding: '4px 10px',
  fontSize: '0.78rem',
  cursor: 'pointer',
}

const copyBtnStyle = {
  background: 'rgba(16,185,129,0.12)',
  color: '#6ee7b7',
  border: '1px solid rgba(16,185,129,0.35)',
  borderRadius: '5px',
  padding: '4px 10px',
  fontSize: '0.78rem',
  cursor: 'pointer',
}

