export default function AbilityPanel({ fleet, onUseAbility, isMyTurn, isTargeting, onCancelTarget }) {
  if (!fleet || fleet.length === 0) return null
  const hasAbilities = fleet.some(s => s.abilityType && s.abilityType !== 'none')
  if (!hasAbilities) return null

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Abilities</div>
      {isTargeting && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px', padding: '6px 12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fbbf24', fontSize: '0.8rem' }}>
          <span>🎯 Click tiles on enemy board</span>
          <button onClick={onCancelTarget} style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem' }}>Cancel</button>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {fleet.map((ship, idx) => {
          if (!ship.abilityType || ship.abilityType === 'none') return null
          const cd = ship.cooldownRemaining || 0
          const disabled = !isMyTurn || ship.isSunk || cd > 0 || isTargeting
          return (
            <button key={idx} onClick={() => !disabled && onUseAbility(idx)}
              disabled={disabled}
              style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: '6px', padding: '5px 10px', color: disabled ? '#475569' : '#60a5fa', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.75rem', opacity: disabled ? 0.6 : 1 }}>
              <div style={{ fontWeight: '600' }}>Ship {idx + 1}</div>
              <div style={{ color: '#64748b', fontSize: '0.68rem' }}>{ship.abilityType}{cd > 0 ? ` (cd:${cd})` : ''}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
