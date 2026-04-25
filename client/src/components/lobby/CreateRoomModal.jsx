import { useState, useEffect, useMemo } from 'react'
import { boards as boardsApi } from '../../services/api'
import useAuth from '../../hooks/useAuth'

export default function CreateRoomModal({ onClose, onSubmit, loading, error }) {
  const { user } = useAuth()
  const [turnTimeLimit, setTurnTimeLimit] = useState(60)
  const [shipLimit, setShipLimit] = useState(5)
  const [password, setPassword] = useState('')
  const [isRanked, setIsRanked] = useState(false)
  const [boardTemplateId, setBoardTemplateId] = useState('')
  const [availableBoards, setAvailableBoards] = useState([])
  const [boardsLoading, setBoardsLoading] = useState(true)

  useEffect(() => {
    boardsApi.list().then(res => {
      const list = res.data || []
      setAvailableBoards(list)
      if (list.length > 0) setBoardTemplateId(list[0]._id || list[0].id)
    }).catch(() => {}).finally(() => setBoardsLoading(false))
  }, [])

  const selectedBoard = availableBoards.find(b => (b._id || b.id) === boardTemplateId)
  const favoriteBoardIds = useMemo(
    () => new Set((user?.favoriteBoards || []).map(String)),
    [user?.favoriteBoards]
  )
  const orderedBoards = useMemo(
    () => [...availableBoards].sort((a, b) => {
      const aFav = favoriteBoardIds.has(String(a._id || a.id))
      const bFav = favoriteBoardIds.has(String(b._id || b.id))
      if (aFav === bFav) return 0
      return aFav ? -1 : 1
    }),
    [availableBoards, favoriteBoardIds]
  )

  function handleSubmit(e) {
    e.preventDefault()
    if (!boardTemplateId) return
    const data = {
      boardSize: selectedBoard?.size || 10,
      turnTimeLimit,
      shipLimit,
      boardTemplateId,
      isRanked,
    }
    if (password) data.password = password
    onSubmit(data)
  }

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '1.3rem' }}>Utwórz pokój</h2>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {boardsLoading ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Ładowanie plansz…</p>
        ) : availableBoards.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Nie masz żadnych plansz. <a href="/boards" style={{ color: '#60a5fa' }}>Stwórz planszę</a>, a następnie wróć tutaj.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Board picker */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Plansza</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {orderedBoards.map(b => {
                  const id = b._id || b.id
                  const isSelected = id === boardTemplateId
                  const isFavorite = favoriteBoardIds.has(String(id))
                  return (
                    <div
                      key={id}
                      onClick={() => setBoardTemplateId(id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                        background: isSelected ? 'rgba(37,99,235,0.15)' : '#0f1923',
                        border: isSelected ? '1px solid rgba(37,99,235,0.5)' : '1px solid rgba(255,255,255,0.08)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>
                        {isFavorite ? '★ ' : ''}{b.name || `Plansza ${b.size}×${b.size}`}
                      </span>
                      <span style={{ color: '#475569', fontSize: '0.78rem' }}>{b.size}×{b.size}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Turn time */}
            <div style={fieldStyle}>
              <label style={labelStyle}>
                Czas na ruch: <strong style={{ color: '#60a5fa' }}>{turnTimeLimit}s</strong>
              </label>
              <input
                type="range" min="10" max="300" step="10" value={turnTimeLimit}
                onChange={e => setTurnTimeLimit(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#2563eb' }}
              />
              <div style={rangeHintsStyle}><span>10s</span><span>5min</span></div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>
                Limit statków: <strong style={{ color: '#60a5fa' }}>{shipLimit}</strong>
              </label>
              <input
                type="range" min="1" max="10" step="1" value={shipLimit}
                onChange={e => setShipLimit(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#2563eb' }}
              />
              <div style={rangeHintsStyle}><span>1</span><span>10</span></div>
            </div>

            {/* Password */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Hasło (opcjonalne)</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
                placeholder="Zostaw puste dla pokoju publicznego"
              />
            </div>

            <div style={{ ...fieldStyle, marginTop: '-2px' }}>
              <label style={{ ...labelStyle, marginBottom: '6px' }}>Tryb gry</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontSize: '0.88rem', cursor: 'pointer' }}>
                <input
                  type='checkbox'
                  checked={isRanked}
                  onChange={(e) => setIsRanked(e.target.checked)}
                />
                Rankingowa (ELO startowe: 800)
              </label>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '6px' }}>
                ELO zmienia się tylko po meczach rankingowych.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" onClick={onClose} style={cancelBtnStyle}>Anuluj</button>
              <button type="submit" disabled={loading || !boardTemplateId} style={submitBtnStyle}>
                {loading ? 'Tworzenie…' : 'Utwórz pokój'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '16px',
}

const modalStyle = {
  background: '#1a2940',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '14px',
  padding: '28px',
  width: '100%',
  maxWidth: '480px',
}

const fieldStyle = { marginBottom: '20px' }

const labelStyle = {
  display: 'block',
  color: '#94a3b8',
  fontSize: '0.85rem',
  fontWeight: '500',
  marginBottom: '8px',
}

const rangeHintsStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  color: '#475569',
  fontSize: '0.75rem',
  marginTop: '4px',
}

const inputStyle = {
  width: '100%',
  background: '#0f1923',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '7px',
  padding: '10px 14px',
  color: '#e2e8f0',
  fontSize: '0.9rem',
}

const errorStyle = {
  background: 'rgba(239,68,68,0.08)',
  border: '1px solid rgba(239,68,68,0.25)',
  color: '#f87171',
  padding: '10px 14px',
  borderRadius: '8px',
  marginBottom: '18px',
  fontSize: '0.875rem',
}

const closeBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#64748b',
  fontSize: '1.2rem',
  cursor: 'pointer',
  lineHeight: 1,
  padding: '4px',
}

const cancelBtnStyle = {
  background: 'rgba(255,255,255,0.05)',
  color: '#94a3b8',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '7px',
  padding: '10px 20px',
  cursor: 'pointer',
  fontSize: '0.9rem',
}

const submitBtnStyle = {
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '7px',
  padding: '10px 24px',
  fontWeight: '600',
  cursor: 'pointer',
  fontSize: '0.9rem',
}
