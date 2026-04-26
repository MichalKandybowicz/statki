import { useMemo, useState } from 'react'
import ShipGrid from '../ships/ShipGrid.jsx'
import { getAbilityInfo, formatCooldownTurns } from '../../utils/abilityInfo.js'
import useAuth from '../../hooks/useAuth'

export default function ShipSelector({ ships, onSelect, selectedShip, onDragStart, onDragEnd, placedShipIds }) {
  const { user } = useAuth()
  const [hoveredId, setHoveredId] = useState(null)

  if (!ships || ships.length === 0) {
    return (
      <div style={{ minWidth: '220px' }}>
        <h3 style={{ color: '#e2e8f0', fontSize: '0.95rem', marginBottom: '10px' }}>Krok 1: Wybierz statki</h3>
        <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Brak statkow. <a href='/ships'>Najpierw stworz statki.</a></p>
      </div>
    )
  }

  const favoriteShipIds = new Set((user?.favoriteShips || []).map(String))
  const normalizedPlacedIds = useMemo(() => {
    if (!placedShipIds) return new Set()
    return placedShipIds instanceof Set ? placedShipIds : new Set(Array.from(placedShipIds).map(String))
  }, [placedShipIds])

  const orderedShips = [...ships].sort((a, b) => {
    const aFav = favoriteShipIds.has(String(a._id || a.id))
    const bFav = favoriteShipIds.has(String(b._id || b.id))
    if (aFav !== bFav) return aFav ? -1 : 1
    const aPlaced = normalizedPlacedIds.has(String(a._id || a.id))
    const bPlaced = normalizedPlacedIds.has(String(b._id || b.id))
    if (aPlaced !== bPlaced) return aPlaced ? 1 : -1
    return 0
  })

  return (
    <div style={{ minWidth: '250px', maxWidth: '340px' }}>
      <h3 style={{ color: '#e2e8f0', fontSize: '0.95rem', marginBottom: '4px' }}>Krok 1: Wybierz statki</h3>
      <p style={{ color: '#64748b', fontSize: '0.72rem', marginBottom: '10px' }}>
        Drag ship onto board · Press <kbd style={kbdStyle}>R</kbd> to rotate · Click placed ship to remove
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {orderedShips.map(ship => {
          const id = String(ship._id || ship.id)
          const selId = String(selectedShip?._id || selectedShip?.id || '')
          const isSelected = id === selId
          const isPlaced = normalizedPlacedIds.has(id)
          const isHovered = hoveredId === id
          const cells = ship.shape?.flat().filter(v => v === 1).length || 0
          const ability = getAbilityInfo(ship.abilityType, ship.size || cells)
          const ownerName = ship.owner?.username || ship.owner?.email?.split('@')[0] || ''

          return (
            <div
              key={id}
              draggable={!isPlaced}
              onMouseEnter={() => setHoveredId(id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => !isPlaced && onSelect(isSelected ? null : ship)}
              onDragStart={e => {
                if (isPlaced) return
                e.dataTransfer.effectAllowed = 'copy'
                e.dataTransfer.setData('text/plain', id)
                onDragStart?.(ship)
              }}
              onDragEnd={() => onDragEnd?.()}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '10px',
                borderRadius: '8px',
                cursor: isPlaced ? 'not-allowed' : 'grab',
                background: isPlaced ? 'rgba(148,163,184,0.08)' : isSelected ? 'rgba(37,99,235,0.18)' : '#1a2940',
                border: isSelected
                  ? '1px solid rgba(37,99,235,0.62)'
                  : isHovered
                    ? '1px solid rgba(148,163,184,0.35)'
                    : '1px solid rgba(255,255,255,0.07)',
                opacity: isPlaced ? 0.72 : 1,
                userSelect: 'none',
                gap: '10px',
                transition: 'all 120ms ease',
              }}
            >
              <ShipGrid shape={ship.shape} readOnly />
              <div style={{ minWidth: 0, width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                  <div style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 700 }}>
                    {favoriteShipIds.has(id) ? '★ ' : ''}{ship.name || 'Nienazwany statek'}
                  </div>
                  <span style={{ color: isPlaced ? '#94a3b8' : '#4ade80', fontSize: '0.66rem', fontWeight: 700 }}>
                    {isPlaced ? 'USTAWIONY' : 'DOSTEPNY'}
                  </span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: '2px' }}>{cells} pol · {ability.label}</div>
                {!ship.isOwn && ownerName && (
                  <div style={{ color: '#64748b', fontSize: '0.68rem', marginBottom: '2px' }}>Autor: {ownerName}</div>
                )}
                <div style={{ color: '#fbbf24', fontSize: '0.68rem', marginBottom: '3px' }}>CD: {formatCooldownTurns(ability.cooldown)}</div>
                <div style={{ color: '#64748b', fontSize: '0.68rem', lineHeight: 1.4 }}>
                  {ability.description}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const kbdStyle = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '3px',
  padding: '1px 4px',
  fontSize: '0.65rem',
  color: '#94a3b8',
}
