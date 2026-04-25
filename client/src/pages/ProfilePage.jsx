import { useEffect, useMemo, useState } from 'react'
import useAuth from '../hooks/useAuth'
import { stats as statsApi } from '../services/api'

export default function ProfilePage() {
  const { user } = useAuth()
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [searchNick, setSearchNick] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedOpponent, setSelectedOpponent] = useState(null)
  const [headToHead, setHeadToHead] = useState(null)
  const [h2hLoading, setH2hLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadHistory() {
      setHistoryLoading(true)
      setHistoryError('')
      try {
        const res = await statsApi.history({ limit: 100 })
        if (!mounted) return
        setHistory(res.data.items || [])
      } catch (err) {
        if (!mounted) return
        setHistoryError(err.response?.data?.error || 'Nie udalo sie pobrac historii meczow')
      } finally {
        if (mounted) setHistoryLoading(false)
      }
    }

    loadHistory()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let active = true

    async function runSearch() {
      const q = searchNick.trim()
      if (q.length < 2) {
        setSearchResults([])
        return
      }

      setSearchLoading(true)
      try {
        const res = await statsApi.searchPlayers(q)
        if (!active) return
        setSearchResults(res.data.items || [])
      } catch {
        if (!active) return
        setSearchResults([])
      } finally {
        if (active) setSearchLoading(false)
      }
    }

    const tid = setTimeout(runSearch, 250)
    return () => {
      active = false
      clearTimeout(tid)
    }
  }, [searchNick])

  async function loadHeadToHead(opponent) {
    setSelectedOpponent(opponent)
    setH2hLoading(true)
    setHeadToHead(null)
    try {
      const res = await statsApi.headToHead(opponent.userId)
      setHeadToHead(res.data)
    } catch {
      setHeadToHead(null)
    } finally {
      setH2hLoading(false)
    }
  }

  const filteredHistory = useMemo(() => {
    const q = searchNick.trim().toLowerCase()
    if (!q) return history
    return history.filter((row) => row.opponentName.toLowerCase().includes(q))
  }, [history, searchNick])

  const totalWins = history.filter((g) => g.didWin).length
  const totalLosses = history.length - totalWins
  const displayName = user?.username || user?.email?.split('@')[0] || 'Gracz'

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '28px 20px' }}>
      <h1 style={{ color: '#e2e8f0', fontSize: '1.7rem', marginBottom: '6px' }}>Profil gracza</h1>
      <p style={{ color: '#94a3b8', marginBottom: '18px' }}>
        {displayName} | Bilans: <b style={{ color: '#22c55e' }}>{totalWins}W</b> - <b style={{ color: '#f87171' }}>{totalLosses}L</b>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(300px, 1fr)', gap: '16px', alignItems: 'start' }}>
        <section style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
            <h2 style={titleStyle}>Historia bitew</h2>
            <input
              value={searchNick}
              onChange={(e) => setSearchNick(e.target.value)}
              placeholder='Filtruj po nicku...'
              style={inputStyle}
            />
          </div>

          {historyLoading && <p style={mutedStyle}>Ladowanie historii...</p>}
          {historyError && <p style={{ ...mutedStyle, color: '#f87171' }}>{historyError}</p>}
          {!historyLoading && !historyError && filteredHistory.length === 0 && <p style={mutedStyle}>Brak meczow do wyswietlenia.</p>}

          {!historyLoading && !historyError && filteredHistory.length > 0 && (
            <div style={{ display: 'grid', gap: '8px' }}>
              {filteredHistory.map((row) => (
                <article key={row.gameId} style={rowStyle}>
                  <div style={{ color: '#e2e8f0', fontWeight: 600 }}>
                    {row.didWin ? 'Wygrana' : 'Przegrana'} vs {row.opponentName}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    Zwyciezca: {row.winnerName} | Koniec: {formatDate(row.endedAt)}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={titleStyle}>Bilans z graczem</h2>
          <p style={{ ...mutedStyle, marginTop: 0 }}>Wyszukaj gracza po nicku i sprawdz head-to-head.</p>

          <input
            value={searchNick}
            onChange={(e) => setSearchNick(e.target.value)}
            placeholder='Wpisz nick (min. 2 znaki)...'
            style={{ ...inputStyle, width: '100%', marginBottom: '8px' }}
          />

          {searchLoading && <p style={mutedStyle}>Szukam graczy...</p>}

          {!searchLoading && searchResults.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {searchResults.map((player) => (
                <button key={player.userId} onClick={() => loadHeadToHead(player)} style={chipStyle}>
                  {player.username}
                </button>
              ))}
            </div>
          )}

          {selectedOpponent && <p style={mutedStyle}>Wybrany: {selectedOpponent.username}</p>}
          {h2hLoading && <p style={mutedStyle}>Liczę bilans...</p>}

          {!h2hLoading && headToHead && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px' }}>
              <p style={{ color: '#e2e8f0', margin: '0 0 8px', fontWeight: 700 }}>Bilans vs {headToHead.opponent.username}</p>
              <p style={mutedStyle}>Mecze: {headToHead.total}</p>
              <p style={{ ...mutedStyle, color: '#22c55e' }}>Wygrane: {headToHead.wins}</p>
              <p style={{ ...mutedStyle, color: '#f87171' }}>Przegrane: {headToHead.losses}</p>
              <p style={mutedStyle}>Remisy/inne: {headToHead.draws}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function formatDate(value) {
  if (!value) return 'brak daty'
  try {
    return new Date(value).toLocaleString('pl-PL')
  } catch {
    return 'brak daty'
  }
}

const cardStyle = {
  background: '#1a2940',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  padding: '14px',
}

const titleStyle = {
  color: '#e2e8f0',
  fontSize: '1.05rem',
  margin: 0,
}

const mutedStyle = {
  color: '#94a3b8',
  fontSize: '0.86rem',
  margin: '4px 0',
}

const rowStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '8px',
  padding: '10px',
}

const inputStyle = {
  background: 'rgba(15,25,35,0.85)',
  color: '#e2e8f0',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '6px',
  padding: '8px 10px',
  fontSize: '0.85rem',
}

const chipStyle = {
  background: 'rgba(37,99,235,0.14)',
  color: '#93c5fd',
  border: '1px solid rgba(37,99,235,0.3)',
  borderRadius: '999px',
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: '0.8rem',
}

