export default function FleetPanel({ fleet }) {
  if (!fleet || fleet.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {fleet.map((ship, idx) => {
        const total = ship.positions?.length || 0
        const hits = ship.hits || 0
        const hp = total > 0 ? Math.max(0, (total - hits) / total * 100) : 100
        const hpColor = hp > 50 ? '#22c55e' : hp > 25 ? '#f59e0b' : '#ef4444'
        return (
          <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '8px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: ship.isSunk ? '#475569' : '#e2e8f0', fontSize: '0.8rem', fontWeight: '600' }}>
                Ship {idx + 1}{ship.isSunk ? ' ✗' : ''}
              </span>
              <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{ship.abilityType || ''}</span>
            </div>
            <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${hp}%`, background: hpColor, borderRadius: '3px', transition: 'width 0.3s' }} />
            </div>
            {(ship.cooldownRemaining || 0) > 0 && (
              <div style={{ color: '#f59e0b', fontSize: '0.68rem', marginTop: '3px' }}>CD: {ship.cooldownRemaining}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
