import { getAbilityInfo, formatCooldownTurns } from '../../utils/abilityInfo.js'

export default function AbilityPanel({ fleet, selectedShipIndex, onUseAbility, isMyTurn, isTargeting, onCancelTarget }) {
  if (!fleet || fleet.length === 0) return null

  const ship = fleet[selectedShipIndex] || fleet[0]
  if (!ship) return null

  const ability = getAbilityInfo(ship.abilityType, ship.positions?.length || 1)
  const cooldownRemaining = ship.cooldownRemaining || 0
  const disabled = !isMyTurn || ship.isSunk || cooldownRemaining > 0 || isTargeting

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
        Umiejętność wybranego statku
      </div>

      {isTargeting && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px', padding: '8px 12px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fbbf24', fontSize: '0.8rem' }}>
          <span>🎯 Wskaż pola na planszy przeciwnika</span>
          <button onClick={onCancelTarget} style={cancelBtnStyle}>Anuluj</button>
        </div>
      )}

      <div style={{ background: '#0f1923', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.92rem' }}>{ship.name || `Statek ${selectedShipIndex + 1}`}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.76rem' }}>{ability.label}</div>
          </div>
          <div style={{ color: '#fbbf24', fontSize: '0.78rem' }}>Bazowy CD: {formatCooldownTurns(ability.cooldown)}</div>
        </div>

        <div style={{ color: '#cbd5e1', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '8px' }}>
          {ability.description}
        </div>
        <div style={{ color: '#64748b', fontSize: '0.74rem', lineHeight: 1.45, marginBottom: '10px' }}>
          {ability.targeting}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
          <span style={{ color: cooldownRemaining > 0 ? '#f59e0b' : '#4ade80', fontSize: '0.76rem', fontWeight: 700 }}>
            {ship.isSunk ? 'Statek zatopiony' : cooldownRemaining > 0 ? `Umiejętność gotowa za ${formatCooldownTurns(cooldownRemaining)}` : 'Umiejętność gotowa'}
          </span>
          <button
            onClick={() => !disabled && onUseAbility(selectedShipIndex)}
            disabled={disabled}
            style={{
              background: 'rgba(37,99,235,0.15)',
              border: '1px solid rgba(37,99,235,0.25)',
              borderRadius: '6px',
              padding: '8px 12px',
              color: disabled ? '#475569' : '#60a5fa',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              fontWeight: 700,
            }}
          >
            {ship.abilityType === 'target' ? 'Wybierz cele' : ship.abilityType === 'linear' ? 'Wybierz linię' : 'Użyj umiejętności'}
          </button>
        </div>
      </div>
    </div>
  )
}

const cancelBtnStyle = {
  background: 'rgba(239,68,68,0.15)',
  color: '#f87171',
  border: '1px solid rgba(239,68,68,0.25)',
  borderRadius: '4px',
  padding: '3px 8px',
  cursor: 'pointer',
  fontSize: '0.75rem',
}
