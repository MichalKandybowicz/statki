import ShipGrid from '../ships/ShipGrid.jsx'
import { getAbilityInfo, formatCooldownTurns } from '../../utils/abilityInfo.js'
import useAuth from '../../hooks/useAuth'

export default function ShipSelector({ ships, onSelect, selectedShip, onDragStart, onDragEnd }) {
  const { user } = useAuth()

  if (!ships || ships.length === 0) {
    return (
      <div style={{ minWidth: '160px' }}>
        <h3 style={{ color: '#e2e8f0', fontSize: '0.95rem', marginBottom: '10px' }}>Statki</h3>
        <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Brak statków. <a href="/ships">Najpierw stwórz statki.</a></p>
      </div>
    )
  }

  const favoriteShipIds = new Set((user?.favoriteShips || []).map(String))
  const orderedShips = [...ships].sort((a, b) => {
    const aFav = favoriteShipIds.has(String(a._id || a.id))
    const bFav = favoriteShipIds.has(String(b._id || b.id))
    if (aFav === bFav) return 0
    return aFav ? -1 : 1
  })

  return (
    <div style={{ minWidth: '240px', maxWidth: '320px' }}>
      <h3 style={{ color: '#e2e8f0', fontSize: '0.95rem', marginBottom: '4px' }}>Wybierz statek</h3>
      <p style={{ color: '#475569', fontSize: '0.7rem', marginBottom: '10px' }}>
        Kliknij lub przeciągnij na planszę · <kbd style={kbdStyle}>R</kbd> obrót
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {orderedShips.map(ship => {
          const id = ship._id || ship.id
          const selId = selectedShip?._id || selectedShip?.id
          const isSelected = id === selId
          const cells = ship.shape?.flat().filter(v => v === 1).length || 0
          const ability = getAbilityInfo(ship.abilityType, ship.size || cells)
          const ownerName = ship.owner?.username || ship.owner?.email?.split('@')[0] || ''
          return (
            <div
              key={id}
              draggable
              onClick={() => onSelect(isSelected ? null : ship)}
              onDragStart={e => {
                e.dataTransfer.effectAllowed = 'copy'
                e.dataTransfer.setData('text/plain', id)
                onDragStart?.(ship)
              }}
              onDragEnd={() => onDragEnd?.()}
              style={{
                display: 'flex', alignItems: 'flex-start', padding: '10px', borderRadius: '7px',
                cursor: 'grab',
                background: isSelected ? 'rgba(37,99,235,0.18)' : '#1a2940',
                border: isSelected ? '1px solid rgba(37,99,235,0.6)' : '1px solid rgba(255,255,255,0.07)',
                userSelect: 'none',
                gap: '10px',
              }}
            >
              <ShipGrid shape={ship.shape} readOnly />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 700, marginBottom: '2px' }}>
                  {favoriteShipIds.has(String(id)) ? '★ ' : ''}{ship.name || 'Nienazwany statek'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: '2px' }}>{cells} pól · {ability.label}</div>
                {!ship.isOwn && ownerName && (
                  <div style={{ color: '#64748b', fontSize: '0.68rem', marginBottom: '2px' }}>Autor: {ownerName}</div>
                )}
                <div style={{ color: '#fbbf24', fontSize: '0.68rem', marginBottom: '3px' }}>CD: {formatCooldownTurns(ability.cooldown)}</div>
                <div style={{ color: '#64748b', fontSize: '0.68rem', lineHeight: 1.4 }}>{ability.description}</div>
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
