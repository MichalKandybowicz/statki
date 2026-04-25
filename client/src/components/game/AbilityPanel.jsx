import { getAbilityInfo, formatCooldownTurns } from '../../utils/abilityInfo.js'

export default function AbilityPanel({
  fleet,
  selectedShipIndex,
  onUseAbility,
  isMyTurn,
  isTargeting,
  onCancelTarget,
  targetingMode,
  linearDirection,
  onSetLinearDirection,
  onConfirmTarget,
  linearPreviewInvalid,
}) {
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
            {ship.abilityType === 'target'
              ? 'Wybierz cele'
              : ship.abilityType === 'linear'
                ? 'Wybierz linię'
                : ship.abilityType === 'diagonal'
                  ? 'Wybierz skos'
                : ship.abilityType === 'sonar'
                  ? 'Wybierz punkt skanu'
                  : ship.abilityType === 'scout_rocket'
                    ? 'Wybierz cel rakiety'
                    : ship.abilityType === 'holy_bomb'
                      ? 'Wybierz wykryte pole'
                      : ship.abilityType === 'ship_shape'
                        ? 'Wybierz punkt zaczepienia'
                  : 'Użyj umiejętności'}
          </button>
        </div>

        {isTargeting && targetingMode && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px', padding: '10px 12px', color: '#fbbf24', fontSize: '0.8rem' }}>
              <div style={{ marginBottom: '8px', lineHeight: 1.45 }}>
                🎯 {ship.name || `Statek ${selectedShipIndex + 1}`} — {targetingMode.type === 'linear'
                  ? `kliknij początek salwy (${linearDirection === 'horizontal' ? 'poziomo' : 'pionowo'}, długość ${ship.positions?.length || 1})`
                  : targetingMode.type === 'diagonal'
                    ? `kliknij początek salwy (${linearDirection === 'down-right' ? '↘ skos w dół' : '↙ skos w dół'}, długość ${ship.positions?.length || 1})`
                  : targetingMode.type === 'sonar'
                    ? 'kliknij pole, z którego ma pójść impuls sonaru'
                    : targetingMode.type === 'scout_rocket'
                      ? 'kliknij pojedyncze pole celu rakiety zwiadowczej'
                      : targetingMode.type === 'holy_bomb'
                        ? 'kliknij pole oznaczone jako wykryte'
                      : targetingMode.type === 'ship_shape'
                        ? 'kliknij pole lewego-górnego rogu wzoru ostrzału'
                    : `wybierz do ${targetingMode.maxTargets} pól (${targetingMode.targets.length}/${targetingMode.maxTargets})`}
              </div>

              {(targetingMode.type === 'linear' || targetingMode.type === 'diagonal' || targetingMode.type === 'ship_shape') && linearPreviewInvalid && (
                <div style={{ color: '#f87171', marginBottom: '8px' }}>Linia wychodzi poza planszę</div>
              )}

              {(targetingMode.type === 'linear' || targetingMode.type === 'diagonal') && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  {targetingMode.type === 'linear' ? (
                    <>
                      <button onClick={() => onSetLinearDirection?.('horizontal')} style={{ ...directionBtnStyle, opacity: linearDirection === 'horizontal' ? 1 : 0.6 }}>Poziomo</button>
                      <button onClick={() => onSetLinearDirection?.('vertical')} style={{ ...directionBtnStyle, opacity: linearDirection === 'vertical' ? 1 : 0.6 }}>Pionowo</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => onSetLinearDirection?.('down-right')} style={{ ...directionBtnStyle, opacity: linearDirection === 'down-right' ? 1 : 0.6 }}>↘</button>
                      <button onClick={() => onSetLinearDirection?.('down-left')} style={{ ...directionBtnStyle, opacity: linearDirection === 'down-left' ? 1 : 0.6 }}>↙</button>
                    </>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {targetingMode.type === 'target' && (
                  <button onClick={onConfirmTarget} disabled={targetingMode.targets.length === 0} style={{ ...confirmBtnStyle, opacity: targetingMode.targets.length > 0 ? 1 : 0.5, cursor: targetingMode.targets.length > 0 ? 'pointer' : 'not-allowed' }}>Zatwierdź</button>
                )}
                <button onClick={onCancelTarget} style={cancelBtnStyle}>Anuluj</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const directionBtnStyle = {
  background: 'rgba(37,99,235,0.15)',
  color: '#60a5fa',
  border: '1px solid rgba(37,99,235,0.25)',
  borderRadius: '5px',
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: '0.78rem',
}

const confirmBtnStyle = {
  background: 'rgba(34,197,94,0.15)',
  color: '#4ade80',
  border: '1px solid rgba(34,197,94,0.25)',
  borderRadius: '5px',
  padding: '3px 10px',
  fontSize: '0.78rem',
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
