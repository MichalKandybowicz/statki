import { useState, useEffect, useMemo } from 'react'
import { boards as boardsApi } from '../services/api'
import useAuth from '../hooks/useAuth'
import BoardGrid from '../components/board/BoardGrid.jsx'
import { createEmptyBoard } from '../utils/boardUtils.js'

export default function BoardBuilderPage() {
  const [size, setSize] = useState(10)
  const [tiles, setTiles] = useState(() => createEmptyBoard(10))
  const [name, setName] = useState('')
  const [savedBoards, setSavedBoards] = useState([])
  const [communityBoards, setCommunityBoards] = useState([])
  const [communityFilters, setCommunityFilters] = useState({
    name: '',
    size: 'all',
  })
  const [editingId, setEditingId] = useState(null)
  const [copyingBoardId, setCopyingBoardId] = useState(null)
  const [expandedCommunityIds, setExpandedCommunityIds] = useState(() => new Set())
  const [error, setError] = useState('')
  const { user, refreshUser } = useAuth()

  useEffect(() => {
    loadBoards()
  }, [])

  useEffect(() => {
    loadCommunityBoards()
  }, [communityFilters])

  useEffect(() => {
    const ids = new Set(communityBoards.map((b) => String(b._id || b.id)))
    setExpandedCommunityIds((prev) => {
      const next = new Set()
      prev.forEach((id) => {
        if (ids.has(id)) next.add(id)
      })
      return next
    })
  }, [communityBoards])

  async function loadBoards() {
    try {
      const res = await boardsApi.list()
      setSavedBoards(res.data || [])
    } catch {
      setSavedBoards([])
    }
  }

  async function loadCommunityBoards() {
    try {
      const params = {}
      if (communityFilters.name.trim()) params.q = communityFilters.name.trim()
      const res = await boardsApi.listCommunity(params)
      const list = Array.isArray(res.data) ? res.data : []
      const sizeFilter = communityFilters.size === 'all' ? null : Number(communityFilters.size)
      setCommunityBoards(
        sizeFilter
          ? list.filter((b) => Number(b.size) === sizeFilter)
          : list
      )
    } catch {
      setCommunityBoards([])
    }
  }

  function newBoard() {
    setTiles(createEmptyBoard(size))
    setEditingId(null)
    setName('')
    setError('')
  }

  function toggleTile(r, c) {
    const t = tiles.map(row => [...row])
    t[r][c] = t[r][c] === 'rock' ? 'water' : 'rock'
    setTiles(t)
  }

  async function handleSave() {
    setError('')
    const trimmedName = name.trim()
    if (!trimmedName) return setError('Podaj nazwę mapy')
    if (trimmedName.length > 60) return setError('Nazwa mapy może mieć maksymalnie 60 znaków')
    const rockCount = tiles.flat().filter(t => t === 'rock').length
    const total = size * size
    if (rockCount / total > 0.2) return setError('Max 20% rocks')

    try {
      if (editingId) await boardsApi.update(editingId, { name: trimmedName, size, tiles })
      else await boardsApi.create({ name: trimmedName, size, tiles })
      await loadBoards()
      setEditingId(null)
      setTiles(createEmptyBoard(size))
      setName('')
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed')
    }
  }

  function handleEdit(b) {
    setEditingId(b._id || b.id)
    setSize(b.size)
    setTiles(b.tiles)
    setName(b.name || '')
    setError('')
  }

  async function handleDelete(id) {
    try {
      await boardsApi.delete(id)
      await loadBoards()
    } catch {}
  }

  async function handleCopyBoard(board) {
    const id = String(board._id || board.id)
    setCopyingBoardId(id)
    try {
      const res = await boardsApi.copy(id)
      const copied = res.data
      await loadBoards()
      await loadCommunityBoards()
      if (copied) {
        handleEdit(copied)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się skopiować mapy')
    } finally {
      setCopyingBoardId(null)
    }
  }

  async function handleToggleFavorite(boardId) {
    try {
      const favoriteIds = new Set((user?.favoriteBoards || []).map(String))
      if (favoriteIds.has(String(boardId))) {
        await boardsApi.unfavorite(boardId)
      } else {
        await boardsApi.favorite(boardId)
      }
      await refreshUser?.()
    } catch {}
  }

  function toggleCommunityPreview(id) {
    const strId = String(id)
    setExpandedCommunityIds((prev) => {
      const next = new Set(prev)
      if (next.has(strId)) next.delete(strId)
      else next.add(strId)
      return next
    })
  }

  const rockCount = tiles.flat().filter(t => t === 'rock').length
  const rockPct = ((rockCount / (size * size)) * 100).toFixed(1)
  const favoriteBoardIds = useMemo(() => new Set((user?.favoriteBoards || []).map(String)), [user?.favoriteBoards])
  const sortedBoards = [...savedBoards].sort((a, b) => {
    const aFav = favoriteBoardIds.has(String(a._id || a.id))
    const bFav = favoriteBoardIds.has(String(b._id || b.id))
    if (aFav === bFav) return 0
    return aFav ? -1 : 1
  })
  const sortedCommunityBoards = [...communityBoards].sort((a, b) => {
    const aFav = favoriteBoardIds.has(String(a._id || a.id))
    const bFav = favoriteBoardIds.has(String(b._id || b.id))
    if (aFav !== bFav) return aFav ? -1 : 1
    const aName = (a.name || '').toLowerCase()
    const bName = (b.name || '').toLowerCase()
    if (aName < bName) return -1
    if (aName > bName) return 1
    return 0
  })

  return (
    <div style={{ maxWidth:'1140px', margin:'0 auto', padding:'32px 20px' }}>
      <h1 style={{ color:'#e2e8f0', marginBottom:'24px' }}>Board Builder</h1>
      <div style={{ display:'flex', gap:'32px', flexWrap:'wrap', alignItems:'flex-start' }}>
        <div style={{ background:'#1a2940', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'24px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px' }}>
            <div>
              <label style={{ color:'#94a3b8', fontSize:'0.82rem', display:'block', marginBottom:'4px' }}>Nazwa mapy</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={60}
                placeholder='Np. Archipelag Północny'
                style={{ width: '100%', boxSizing:'border-box', background:'#0f1923', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'8px', padding:'10px 12px', color:'#e2e8f0', fontSize:'0.9rem' }}
              />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:'180px' }}>
                <label style={{ color:'#94a3b8', fontSize:'0.82rem', display:'block', marginBottom:'4px' }}>Rozmiar: {size}×{size}</label>
                <input
                  type='range'
                  min='10'
                  max='25'
                  value={size}
                  onChange={e => {
                    const s = Number(e.target.value)
                    setSize(s)
                    setTiles(createEmptyBoard(s))
                    setEditingId(null)
                    setName('')
                  }}
                  style={{ accentColor:'#2563eb', width:'100%' }}
                />
              </div>
              <button onClick={newBoard} style={{ background:'rgba(255,255,255,0.07)', color:'#94a3b8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', padding:'7px 14px', cursor:'pointer', fontSize:'0.85rem', flexShrink:0 }}>Wyczyść</button>
            </div>
          </div>
          <div style={{ color:'#64748b', fontSize:'0.78rem', marginBottom:'10px' }}>Rocks: {rockCount} ({rockPct}%) — max 20%</div>
          <BoardGrid tiles={tiles} size={size} onToggle={toggleTile} />
          {error && <div style={{ color:'#f87171', fontSize:'0.8rem', marginTop:'8px' }}>{error}</div>}
          <button onClick={handleSave} style={{ marginTop:'14px', background:'#2563eb', color:'white', border:'none', borderRadius:'7px', padding:'9px 20px', fontWeight:'600', cursor:'pointer' }}>{editingId ? 'Update Board' : 'Save Board'}</button>
          {editingId && <button onClick={() => { setEditingId(null); setTiles(createEmptyBoard(size)); setName('') }} style={{ marginTop:'14px', marginLeft:'8px', background:'rgba(255,255,255,0.05)', color:'#94a3b8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', padding:'9px 14px', cursor:'pointer' }}>Cancel</button>}
        </div>

        <div style={{ flex:1, minWidth:'300px' }}>
          <h2 style={{ color:'#e2e8f0', fontSize:'1.1rem', marginBottom:'14px' }}>Saved Boards ({savedBoards.length})</h2>
          {savedBoards.length === 0 ? <p style={{ color:'#64748b' }}>No boards yet.</p> :
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'22px' }}>
              {sortedBoards.map(b => (
                <div key={b._id||b.id} style={{ background:'#1a2940', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ color:'#e2e8f0', fontSize:'0.88rem' }}>{favoriteBoardIds.has(String(b._id||b.id)) ? '★ ' : ''}{b.name || `${b.size}×${b.size}`}</span>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={() => handleToggleFavorite(b._id||b.id)} style={favoriteBtnStyle}>{favoriteBoardIds.has(String(b._id||b.id)) ? '★' : '☆'}</button>
                    <button onClick={() => handleEdit(b)} style={editBtnStyle}>Edit</button>
                    <button onClick={() => handleDelete(b._id||b.id)} style={deleteBtnStyle}>Delete</button>
                  </div>
                </div>
              ))}
            </div>}

          <h2 style={{ color:'#e2e8f0', fontSize:'1.1rem', marginBottom:'10px' }}>Mapy społeczności ({communityBoards.length})</h2>
          <div style={{ display:'grid', gridTemplateColumns:'minmax(140px, 1fr) minmax(130px, 150px)', gap:'8px', marginBottom:'10px' }}>
            <input
              value={communityFilters.name}
              onChange={e => setCommunityFilters(prev => ({ ...prev, name: e.target.value }))}
              placeholder='Szukaj po nazwie/autorze'
              style={filterInputStyle}
            />
            <select
              value={communityFilters.size}
              onChange={e => setCommunityFilters(prev => ({ ...prev, size: e.target.value }))}
              style={filterInputStyle}
            >
              <option value='all'>Każdy rozmiar</option>
              {Array.from({ length: 16 }).map((_, idx) => {
                const val = idx + 10
                return <option key={val} value={val}>{val}×{val}</option>
              })}
            </select>
            <button
              type='button'
              onClick={() => setCommunityFilters({ name: '', size: 'all' })}
              style={{ ...secondaryBtnStyle, gridColumn:'1 / -1' }}
            >
              Wyczyść filtry
            </button>
          </div>

          {communityBoards.length === 0 ? (
            <p style={{ color:'#64748b' }}>Brak map społeczności dla wybranych filtrów.</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {sortedCommunityBoards.map((b) => {
                const id = b._id || b.id
                const idStr = String(id)
                const isExpanded = expandedCommunityIds.has(idStr)
                const ownerLabel = b.owner?.username || b.owner?.email?.split('@')[0] || 'nieznany autor'
                return (
                  <div key={`community-${id}`} style={{ background:'#1a2940', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'12px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', marginBottom:'8px', flexWrap:'wrap' }}>
                      <div>
                        <div style={{ color:'#e2e8f0', fontSize:'0.9rem', fontWeight:700 }}>{b.name || `${b.size}×${b.size}`}</div>
                        <div style={{ color:'#64748b', fontSize:'0.74rem' }}>Autor: {ownerLabel} · Rozmiar: {b.size}×{b.size}</div>
                      </div>
                      <div style={{ display:'flex', gap:'6px' }}>
                        <button onClick={() => toggleCommunityPreview(id)} style={editBtnStyle}>{isExpanded ? 'Zwiń podgląd' : 'Rozwiń podgląd'}</button>
                        <button onClick={() => handleToggleFavorite(id)} style={favoriteBtnStyle}>{favoriteBoardIds.has(String(id)) ? '★' : '☆'}</button>
                        <button onClick={() => handleCopyBoard(b)} style={copyBtnStyle}>
                          {copyingBoardId === String(id) ? 'Kopiowanie…' : 'Kopiuj i edytuj'}
                        </button>
                      </div>
                    </div>
                    {isExpanded && <BoardGrid tiles={b.tiles} size={b.size} readOnly />}
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

const editBtnStyle = {
  background:'rgba(37,99,235,0.15)',
  color:'#60a5fa',
  border:'1px solid rgba(37,99,235,0.25)',
  borderRadius:'5px',
  padding:'4px 10px',
  cursor:'pointer',
  fontSize:'0.78rem',
}

const deleteBtnStyle = {
  background:'rgba(239,68,68,0.1)',
  color:'#f87171',
  border:'1px solid rgba(239,68,68,0.2)',
  borderRadius:'5px',
  padding:'4px 10px',
  cursor:'pointer',
  fontSize:'0.78rem',
}

const favoriteBtnStyle = {
  background:'rgba(251,191,36,0.12)',
  color:'#fbbf24',
  border:'1px solid rgba(251,191,36,0.28)',
  borderRadius:'5px',
  padding:'4px 10px',
  cursor:'pointer',
  fontSize:'0.78rem',
}

const copyBtnStyle = {
  background:'rgba(16,185,129,0.12)',
  color:'#6ee7b7',
  border:'1px solid rgba(16,185,129,0.3)',
  borderRadius:'5px',
  padding:'4px 10px',
  cursor:'pointer',
  fontSize:'0.78rem',
}

const filterInputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background:'#0f1923',
  border:'1px solid rgba(255,255,255,0.12)',
  borderRadius:'8px',
  padding:'8px 10px',
  color:'#e2e8f0',
  fontSize:'0.84rem',
}

const secondaryBtnStyle = {
  background:'rgba(255,255,255,0.05)',
  color:'#94a3b8',
  border:'1px solid rgba(255,255,255,0.12)',
  borderRadius:'8px',
  padding:'8px 12px',
  cursor:'pointer',
  fontSize:'0.82rem',
}
