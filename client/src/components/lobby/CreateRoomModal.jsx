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
  const [ownBoards, setOwnBoards] = useState([])
  const [communityBoards, setCommunityBoards] = useState([])
  const [boardQuery, setBoardQuery] = useState('')
  const [boardsLoading, setBoardsLoading] = useState(true)
  const [boardsError, setBoardsError] = useState('')

  async function loadBoardCatalog(query = '') {
    setBoardsLoading(true)
    setBoardsError('')
    const [ownRes, communityRes] = await Promise.allSettled([
      boardsApi.list(),
      boardsApi.listCommunity({ q: query || undefined }),
    ])

    const ownList = ownRes.status === 'fulfilled' ? (Array.isArray(ownRes.value.data) ? ownRes.value.data : []) : []
    const communityList = communityRes.status === 'fulfilled' ? (Array.isArray(communityRes.value.data) ? communityRes.value.data : []) : []

    setOwnBoards(ownList)
    setCommunityBoards(communityList)

    if (ownRes.status !== 'fulfilled' && communityRes.status !== 'fulfilled') {
      setBoardsError('Nie udało się pobrać listy map. Spróbuj odświeżyć listę.')
    }

    setBoardsLoading(false)
  }

  useEffect(() => {
    let mounted = true
    loadBoardCatalog().catch(() => {
      if (mounted) {
        setOwnBoards([])
        setCommunityBoards([])
        setBoardsError('Nie udało się pobrać listy map. Spróbuj odświeżyć listę.')
        setBoardsLoading(false)
      }
    })

    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let active = true
    const tid = setTimeout(async () => {
      try {
        setBoardsError('')
        const res = await boardsApi.listCommunity({ q: boardQuery.trim() || undefined })
        if (!active) return
        setCommunityBoards(Array.isArray(res.data) ? res.data : [])
      } catch {
        if (active) {
          setCommunityBoards([])
          if (ownBoards.length === 0) {
            setBoardsError('Nie udało się pobrać map społeczności.')
          }
        }
      }
    }, 250)

    return () => {
      active = false
      clearTimeout(tid)
    }
  }, [boardQuery, ownBoards.length])

  const allBoards = useMemo(() => {
    const map = new Map()
    for (const board of ownBoards || []) {
      const id = String(board._id || board.id)
      if (!id) continue
      map.set(id, {
        ...board,
        owner: {
          _id: user?._id,
          username: user?.username,
          email: user?.email,
        },
        source: 'own',
      })
    }
    for (const board of communityBoards || []) {
      const id = String(board._id || board.id)
      if (!id || map.has(id)) continue
      map.set(id, { ...board, source: 'community' })
    }
    return Array.from(map.values())
  }, [ownBoards, communityBoards, user?._id, user?.username, user?.email])

  useEffect(() => {
    if (allBoards.length === 0) return
    const hasCurrent = allBoards.some((b) => String(b._id || b.id) === String(boardTemplateId))
    if (!hasCurrent) {
      setBoardTemplateId(String(allBoards[0]._id || allBoards[0].id))
    }
  }, [allBoards, boardTemplateId])

  const selectedBoard = allBoards.find(b => String(b._id || b.id) === String(boardTemplateId))
  const favoriteBoardIds = useMemo(
    () => new Set((user?.favoriteBoards || []).map(String)),
    [user?.favoriteBoards]
  )
  const filteredBoards = useMemo(() => {
    const q = boardQuery.trim().toLowerCase()
    if (!q) return allBoards
    return allBoards.filter((b) => {
      const ownerName = b.owner?.username || b.owner?.email?.split('@')[0] || ''
      return (b.name || '').toLowerCase().includes(q) || ownerName.toLowerCase().includes(q)
    })
  }, [allBoards, boardQuery])
  const orderedBoards = useMemo(
    () => [...filteredBoards].sort((a, b) => {
      const aFav = favoriteBoardIds.has(String(a._id || a.id))
      const bFav = favoriteBoardIds.has(String(b._id || b.id))
      if (aFav !== bFav) return aFav ? -1 : 1
      if (a.source !== b.source) return a.source === 'own' ? -1 : 1
      const aName = (a.name || '').toLowerCase()
      const bName = (b.name || '').toLowerCase()
      if (aName < bName) return -1
      if (aName > bName) return 1
      return 0
    }),
    [filteredBoards, favoriteBoardIds]
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
        ) : boardsError ? (
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>
            <div style={{ marginBottom: '8px' }}>{boardsError}</div>
            <button
              type='button'
              onClick={() => loadBoardCatalog(boardQuery.trim()).catch(() => {})}
              style={{ background: 'rgba(37,99,235,0.15)', color: '#93c5fd', border: '1px solid rgba(37,99,235,0.3)', borderRadius: '7px', padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem' }}
            >
              Odśwież listę map
            </button>
          </div>
        ) : allBoards.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Brak dostępnych plansz. <a href="/boards" style={{ color: '#60a5fa' }}>Stwórz planszę</a> albo dodaj ulubione mapy społeczności.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Board picker */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Plansza</label>
              <input
                value={boardQuery}
                onChange={(e) => setBoardQuery(e.target.value)}
                style={{ ...inputStyle, marginBottom: '8px' }}
                placeholder='Szukaj po nazwie planszy lub autorze...'
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {orderedBoards.map(b => {
                  const id = b._id || b.id
                  const isSelected = String(id) === String(boardTemplateId)
                  const isFavorite = favoriteBoardIds.has(String(id))
                  const ownerName = b.source === 'own'
                    ? (user?.username || user?.email?.split('@')[0] || 'Ty')
                    : (b.owner?.username || b.owner?.email?.split('@')[0] || 'Społeczność')
                  return (
                    <div
                      key={id}
                      onClick={() => setBoardTemplateId(String(id))}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                        background: isSelected ? 'rgba(37,99,235,0.15)' : '#0f1923',
                        border: isSelected ? '1px solid rgba(37,99,235,0.5)' : '1px solid rgba(255,255,255,0.08)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>
                          {isFavorite ? '★ ' : ''}{b.name || `Plansza ${b.size}×${b.size}`}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
                          {b.source === 'own' ? 'Twoja plansza' : `Autor: ${ownerName}`}
                        </div>
                      </div>
                      <span style={{ color: '#475569', fontSize: '0.78rem', flexShrink: 0 }}>{b.size}×{b.size}</span>
                    </div>
                  )
                })}
                {orderedBoards.length === 0 && (
                  <div style={{ color: '#64748b', fontSize: '0.82rem', padding: '8px 2px' }}>Brak wyników dla podanej frazy.</div>
                )}
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
                Rankingowa
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
