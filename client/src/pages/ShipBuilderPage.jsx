import { useState, useEffect } from 'react'
import { ships as shipsApi } from '../services/api'
import ShipGrid from '../components/ships/ShipGrid.jsx'
import ShipCard from '../components/ships/ShipCard.jsx'
import useAuth from '../hooks/useAuth'
import { isContiguous, getShipCells } from '../utils/boardUtils.js'
import { getAbilityCards, getAbilityInfo, formatCooldownTurns } from '../utils/abilityInfo.js'

const EMPTY = () => Array.from({ length: 4 }, () => Array(4).fill(0))

export default function ShipBuilderPage() {
  const [name, setName] = useState('')
  const [shape, setShape] = useState(EMPTY())
  const [abilityType, setAbilityType] = useState('linear')
  const [savedShips, setSavedShips] = useState([])
  const [communityShips, setCommunityShips] = useState([])
  const [communityFilters, setCommunityFilters] = useState({
    name: '',
    abilityType: 'all',
    size: 'all',
  })
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [copyingShipId, setCopyingShipId] = useState(null)
  const [catalogError, setCatalogError] = useState('')
  const { user, refreshUser } = useAuth()

  useEffect(() => {
    loadShips()
  }, [])

  useEffect(() => {
    loadCommunityShips()
  }, [communityFilters])

  async function loadShips() {
    try {
      const res = await shipsApi.list()
      setSavedShips(res.data || [])
      setCatalogError('')
    } catch {
      setSavedShips([])
      setCatalogError('Nie udało się pobrać Twoich statków.')
    }
  }

  async function loadCommunityShips() {
    try {
      const params = {}
      if (communityFilters.name.trim()) params.name = communityFilters.name.trim()
      if (communityFilters.abilityType !== 'all') params.abilityType = communityFilters.abilityType
      if (communityFilters.size !== 'all') params.size = Number(communityFilters.size)

      const res = await shipsApi.listCommunity(params)
      const ships = Array.isArray(res.data) ? res.data : []
      // Endpoint już filtruje ownerId, ale zostawiamy bezpiecznik po stronie UI.
      setCommunityShips(ships.filter(ship => !ship.isOwn))
      setCatalogError(prev => prev === 'Nie udało się pobrać statków społeczności.' ? '' : prev)
    } catch {
      setCommunityShips([])
      setCatalogError(prev => prev || 'Nie udało się pobrać statków społeczności.')
    }
  }

  async function retryCatalog() {
    setCatalogError('')
    await Promise.allSettled([loadShips(), loadCommunityShips()])
  }

  function toggle(r, c) {
    const s = shape.map(row => [...row])
    s[r][c] = s[r][c] === 1 ? 0 : 1
    setShape(s)
  }

  function resetForm() {
    setName('')
    setShape(EMPTY())
    setAbilityType('linear')
    setEditingId(null)
    setError('')
  }

  async function handleSave() {
    setError('')
    const trimmedName = name.trim()
    const cells = getShipCells(shape)

    if (!trimmedName) return setError('Podaj nazwę statku')
    if (trimmedName.length > 40) return setError('Nazwa statku może mieć maksymalnie 40 znaków')
    if (cells.length === 0) return setError('Statek musi mieć przynajmniej 1 pole')
    if (cells.length > 7) return setError('Maksymalnie 7 pól')
    if (!isContiguous(shape)) return setError('Pola statku muszą się ze sobą łączyć')

    try {
      const payload = { name: trimmedName, shape, abilityType }
      if (editingId) await shipsApi.update(editingId, payload)
      else await shipsApi.create(payload)
      await loadShips()
      await loadCommunityShips()
      resetForm()
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się zapisać statku')
    }
  }

  async function handleDelete(id) {
    try {
      await shipsApi.delete(id)
      await loadShips()
      await loadCommunityShips()
      if (editingId === id) resetForm()
    } catch {}
  }

  async function handleToggleFavorite(ship) {
    const id = ship._id || ship.id
    const favoriteIds = new Set((user?.favoriteShips || []).map(String))
    try {
      if (favoriteIds.has(String(id))) {
        await shipsApi.unfavorite(id)
      } else {
        await shipsApi.favorite(id)
      }
      await refreshUser?.()
    } catch {}
  }

  async function handleCopyShip(ship) {
    const id = ship._id || ship.id
    setCopyingShipId(String(id))
    try {
      await shipsApi.copy(id)
      await loadShips()
      await loadCommunityShips()
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się skopiować statku')
    } finally {
      setCopyingShipId(null)
    }
  }

  function handleEdit(ship) {
    setName(ship.name || '')
    setShape(ship.shape)
    setAbilityType(ship.abilityType || 'linear')
    setEditingId(ship._id || ship.id)
    setError('')
  }

  const cellCount = getShipCells(shape).length
  const selectedAbility = getAbilityInfo(abilityType, cellCount || 1)
  const abilityCards = getAbilityCards(cellCount || 1)
  const favoriteShipIds = new Set((user?.favoriteShips || []).map(String))
  const sortedMyShips = [...savedShips].sort((a, b) => {
    const aFav = favoriteShipIds.has(String(a._id || a.id))
    const bFav = favoriteShipIds.has(String(b._id || b.id))
    if (aFav === bFav) return 0
    return aFav ? -1 : 1
  })
  const inp = {
    width: '100%',
    background: '#0f1923',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#e2e8f0',
    fontSize: '0.92rem',
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ color: '#e2e8f0', marginBottom: '8px' }}>Kreator statków</h1>
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '0.92rem' }}>
        Zdefiniuj nazwę, kształt i specjalną umiejętność statku. Cooldown pokazuje, ile pełnych tur musi minąć po użyciu zdolności.
      </p>

      {catalogError && (
        <div style={{ marginBottom:'14px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', color:'#f87171', padding:'10px 12px', borderRadius:'8px', display:'flex', justifyContent:'space-between', gap:'10px', alignItems:'center' }}>
          <span style={{ fontSize:'0.84rem' }}>{catalogError}</span>
          <button type='button' onClick={retryCatalog} style={{ background:'rgba(37,99,235,0.15)', color:'#93c5fd', border:'1px solid rgba(37,99,235,0.3)', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.78rem' }}>Odśwież</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '0 0 420px', maxWidth: '100%', background: '#1a2940', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '24px' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '1.1rem', marginBottom: '16px' }}>
            {editingId ? 'Edytuj statek' : 'Nowy statek'}
          </h2>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Nazwa statku</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={40}
              placeholder="Np. Niszczyciel Burza"
              style={inp}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Kształt</label>
            <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '10px' }}>
              Klikaj pola, aby budować statek. Maksymalnie 7 pól, wszystkie muszą się łączyć.
            </p>
            <ShipGrid shape={shape} onToggle={toggle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            {abilityCards.map(ability => {
              const selected = ability.key === abilityType
              return (
                <button
                  key={ability.key}
                  type="button"
                  onClick={() => setAbilityType(ability.key)}
                  style={{
                    textAlign: 'left',
                    background: selected ? 'rgba(37,99,235,0.18)' : '#0f1923',
                    border: selected ? '1px solid rgba(37,99,235,0.55)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    padding: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.88rem' }}>{ability.label}</span>
                    <span style={{ color: '#fbbf24', fontSize: '0.75rem' }}>CD {formatCooldownTurns(ability.cooldown)}</span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.76rem', lineHeight: 1.45 }}>{ability.description}</div>
                  <div style={{ color: '#64748b', fontSize: '0.7rem', lineHeight: 1.4, marginTop: '6px' }}>{ability.requirement}</div>
                </button>
              )
            })}
          </div>

          <div style={{ background: '#0f1923', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: '6px' }}>{selectedAbility.label}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '8px' }}>{selectedAbility.description}</div>
            <div style={{ color: '#fbbf24', fontSize: '0.8rem', marginBottom: '4px' }}>Cooldown: {formatCooldownTurns(selectedAbility.cooldown)}</div>
            <div style={{ color: '#64748b', fontSize: '0.76rem' }}>{selectedAbility.targeting}</div>
            <div style={{ color: '#64748b', fontSize: '0.76rem', marginTop: '6px' }}>{selectedAbility.requirement}</div>
          </div>

          <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '12px' }}>Pola: {cellCount}/7</div>
          {error && <div style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: '10px' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={handleSave} style={primaryBtnStyle}>{editingId ? 'Zapisz zmiany' : 'Zapisz statek'}</button>
            {(editingId || name || cellCount > 0) && (
              <button onClick={resetForm} style={secondaryBtnStyle}>Wyczyść</button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: '280px' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '1.1rem', marginBottom: '14px' }}>Moje statki ({savedShips.length})</h2>
          {savedShips.length === 0 ? (
            <p style={{ color: '#64748b' }}>Nie masz jeszcze żadnych statków.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sortedMyShips.map(s => (
                <ShipCard
                  key={s._id || s.id}
                  ship={s}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorite={favoriteShipIds.has(String(s._id || s.id))}
                />
              ))}
            </div>
          )}

          <h2 style={{ color: '#e2e8f0', fontSize: '1.1rem', marginTop: '26px', marginBottom: '14px' }}>Wszystkie statki w grze ({communityShips.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) minmax(140px, 1fr)', gap: '8px', marginBottom: '10px' }}>
            <input
              value={communityFilters.name}
              onChange={e => setCommunityFilters(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Szukaj po nazwie"
              style={inp}
            />
            <select
              value={communityFilters.abilityType}
              onChange={e => setCommunityFilters(prev => ({ ...prev, abilityType: e.target.value }))}
              style={inp}
            >
              <option value="all">Wszystkie zdolności</option>
              <option value="linear">Liniowy strzał</option>
              <option value="diagonal">Ostrzał skośny</option>
              <option value="random">Losowy ostrzał</option>
              <option value="target">Atak obszarowy</option>
              <option value="sonar">Sonar</option>
              <option value="scout_rocket">Rakieta zwiadowcza</option>
              <option value="holy_bomb">Święta bomba</option>
              <option value="ship_shape">Ostrzał w kształcie statku</option>
            </select>
            <select
              value={communityFilters.size}
              onChange={e => setCommunityFilters(prev => ({ ...prev, size: e.target.value }))}
              style={inp}
            >
              <option value="all">Każdy rozmiar</option>
              {Array.from({ length: 7 }).map((_, idx) => (
                <option key={idx + 1} value={idx + 1}>Rozmiar {idx + 1}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setCommunityFilters({ name: '', abilityType: 'all', size: 'all' })}
              style={secondaryBtnStyle}
            >
              Wyczyść filtry
            </button>
          </div>
          {communityShips.length === 0 ? (
            <p style={{ color: '#64748b' }}>Brak statków do wyświetlenia.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {communityShips.map(s => {
                const isOwn = !!s.isOwn
                const ownerLabel = s.owner ? `Autor: ${s.owner.username || s.owner.email?.split('@')[0] || 'nieznany'}` : 'Autor: nieznany'
                return (
                  <div key={`community-${s._id || s.id}`}>
                    <div style={{ color: '#64748b', fontSize: '0.72rem', marginBottom: '4px' }}>{ownerLabel}</div>
                    <ShipCard
                      ship={s}
                      onToggleFavorite={handleToggleFavorite}
                      isFavorite={favoriteShipIds.has(String(s._id || s.id))}
                      onSecondaryAction={!isOwn ? handleCopyShip : undefined}
                      secondaryActionLabel={copyingShipId === String(s._id || s.id) ? 'Kopiowanie…' : (!isOwn ? 'Kopiuj' : undefined)}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  color: '#94a3b8',
  fontSize: '0.82rem',
  marginBottom: '6px',
}

const primaryBtnStyle = {
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  padding: '10px 18px',
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryBtnStyle = {
  background: 'rgba(255,255,255,0.05)',
  color: '#94a3b8',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  padding: '10px 14px',
  cursor: 'pointer',
}
