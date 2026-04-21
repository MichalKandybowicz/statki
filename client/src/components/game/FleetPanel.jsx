import { getAbilityInfo } from '../../utils/abilityInfo.js'

export default function FleetPanel({ fleet, selectedShipIndex, onSelectShip }) {
  if (!fleet || fleet.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {fleet.map((ship, idx) => {
        const total = ship.positions?.length || 0
        const hits = Array.isArray(ship.hits) ? ship.hits.length : Number(ship.hits || 0)
        const hp = total > 0 ? Math.max(0, ((total - hits) / total) * 100) : 100
        const hpColor = hp > 50 ? '#22c55e' : hp > 25 ? '#f59e0b' : '#ef4444'
        const ability = getAbilityInfo(ship.abilityType)
        const isSelected = idx === selectedShipIndex

        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectShip?.(idx)}
            style={{
              background: isSelected ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.03)',
              border: isSelected ? '1px solid rgba(37,99,235,0.45)' : '1px solid rgba(255,255,255,0.07)',
              borderRadius: '8px',
              padding: '10px 12px',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
              <span style={{ color: ship.isSunk ? '#64748b' : '#e2e8f0', fontSize: '0.84rem', fontWeight: '700' }}>
                {ship.name || `Statek ${idx + 1}`}{ship.isSunk ? ' ✗' : ''}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{total - hits}/{total} HP</span>
            </div>

            <div style={{ color: '#64748b', fontSize: '0.72rem', marginBottom: '6px' }}>
              {ability.label}
            </div>

            <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ height: '100%', width: `${hp}%`, background: hpColor, borderRadius: '3px', transition: 'width 0.3s' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.68rem' }}>
              <span style={{ color: '#fbbf24' }}>
                {ship.cooldownRemaining > 0 ? `Gotowe za ${ship.cooldownRemaining} tur` : 'Umiejętność gotowa'}
              </span>
              <span style={{ color: '#64748b' }}>Bazowy CD: {ability.cooldown}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
