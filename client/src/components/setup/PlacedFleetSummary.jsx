import { getAbilityInfo, formatCooldownTurns } from '../../utils/abilityInfo.js'
import ShipGrid from '../ships/ShipGrid.jsx'

export default function PlacedFleetSummary({ placedShips, availableShips }) {
  if (placedShips.length === 0) {
    return (
      <div style={summaryPanelStyle}>
        <h3 style={{ color: '#e2e8f0', fontSize: '0.95rem', marginBottom: '10px' }}>Umieszczone statki</h3>
        <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
          Tutaj pojawią się umieszczone na mapie statki.
        </p>
      </div>
    )
  }

  // Build a map of shipTemplateId -> ship data for quick lookup
  const shipMap = new Map()
  for (const ship of availableShips || []) {
    const id = String(ship._id || ship.id)
    if (id) shipMap.set(id, ship)
  }

  const convertRowColToLabel = (r, c) => {
    return `${String.fromCharCode(65 + r)}${c + 1}`
  }

  return (
    <div style={summaryPanelStyle}>
      <h3 style={{ color: '#e2e8f0', fontSize: '0.95rem', marginBottom: '10px' }}>
        Umieszczone statki ({placedShips.length})
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {placedShips.map((placedShip, idx) => {
          const shipId = String(placedShip.shipTemplateId)
          const shipData = shipMap.get(shipId)

          if (!shipData) {
            return (
              <div key={idx} style={shipItemStyle}>
                <div style={{ color: '#f87171', fontSize: '0.82rem' }}>
                  Statek #{idx + 1} (nieznany szablon)
                </div>
              </div>
            )
          }

          const cells = shipData.shape?.flat().filter(v => v === 1).length || 0
          const ability = getAbilityInfo(shipData.abilityType, cells)

          // Get first and last cell to show position range
          const sortedCells = [...placedShip.cells].sort((a, b) => a.r !== b.r ? a.r - b.r : a.c - b.c)
          const firstCell = sortedCells[0]
          const lastCell = sortedCells[sortedCells.length - 1]
          const posLabel = firstCell.r === lastCell.r && firstCell.c === lastCell.c
            ? convertRowColToLabel(firstCell.r, firstCell.c)
            : `${convertRowColToLabel(firstCell.r, firstCell.c)}–${convertRowColToLabel(lastCell.r, lastCell.c)}`

          return (
            <div key={idx} style={shipItemStyle}>
              <div style={{ flex: '0 0 auto' }}>
                <ShipGrid shape={shipData.shape} readOnly />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 700, marginBottom: '2px' }}>
                  {shipData.name || 'Nienazwany statek'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: '2px' }}>
                  {cells} pól · {ability.label}
                </div>
                <div style={{ color: '#60a5fa', fontSize: '0.72rem', marginBottom: '4px' }}>
                  📍 {posLabel}
                </div>
                <div style={{ color: '#fbbf24', fontSize: '0.68rem', marginBottom: '2px' }}>
                  CD: {formatCooldownTurns(ability.cooldown)}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.68rem', lineHeight: 1.3 }}>
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

const summaryPanelStyle = {
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  background: '#1a2940',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  padding: '14px',
  flex: 1,
}

const shipItemStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  padding: '10px',
  background: '#0f1923',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '8px',
}
