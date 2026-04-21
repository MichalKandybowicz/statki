import { useState, useEffect } from 'react'
import { boards as boardsApi } from '../services/api'
import useAuth from '../hooks/useAuth'
import BoardGrid from '../components/board/BoardGrid.jsx'
import { createEmptyBoard } from '../utils/boardUtils.js'

export default function BoardBuilderPage() {
  const [size, setSize] = useState(10)
  const [tiles, setTiles] = useState(() => createEmptyBoard(10))
  const [name, setName] = useState('')
  const [savedBoards, setSavedBoards] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const { user, refreshUser } = useAuth()

  useEffect(() => { loadBoards() }, [])

  async function loadBoards() {
    try { const res = await boardsApi.list(); setSavedBoards(res.data || []) } catch {}
  }

  function newBoard() { setTiles(createEmptyBoard(size)); setEditingId(null); setName('') }

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
      await loadBoards(); setEditingId(null); setTiles(createEmptyBoard(size)); setName('')
    } catch (err) { setError(err.response?.data?.error || 'Save failed') }
  }

  function handleEdit(b) { setEditingId(b._id||b.id); setSize(b.size); setTiles(b.tiles); setName(b.name || '') }
  async function handleDelete(id) { try { await boardsApi.delete(id); await loadBoards() } catch {} }

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

  const rockCount = tiles.flat().filter(t => t === 'rock').length
  const rockPct = ((rockCount / (size * size)) * 100).toFixed(1)
  const favoriteBoardIds = new Set((user?.favoriteBoards || []).map(String))
  const sortedBoards = [...savedBoards].sort((a, b) => {
    const aFav = favoriteBoardIds.has(String(a._id || a.id))
    const bFav = favoriteBoardIds.has(String(b._id || b.id))
    if (aFav === bFav) return 0
    return aFav ? -1 : 1
  })

  return (
    <div style={{ maxWidth:'1000px', margin:'0 auto', padding:'32px 20px' }}>
      <h1 style={{ color:'#e2e8f0', marginBottom:'24px' }}>Board Builder</h1>
      <div style={{ display:'flex', gap:'32px', flexWrap:'wrap', alignItems:'flex-start' }}>
        <div style={{ background:'#1a2940', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'24px' }}>
          <div style={{ display:'flex', gap:'12px', alignItems:'center', marginBottom:'16px', flexWrap:'wrap' }}>
            <div style={{ minWidth: '230px', flex: 1 }}>
              <label style={{ color:'#94a3b8', fontSize:'0.82rem', display:'block', marginBottom:'4px' }}>Nazwa mapy</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={60}
                placeholder='Np. Archipelag Północny'
                style={{ width: '100%', background:'#0f1923', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'8px', padding:'10px 12px', color:'#e2e8f0', fontSize:'0.9rem' }}
              />
            </div>
            <div>
              <label style={{ color:'#94a3b8', fontSize:'0.82rem', display:'block', marginBottom:'4px' }}>Size: {size}×{size}</label>
              <input type="range" min="10" max="25" value={size} onChange={e => { const s=Number(e.target.value); setSize(s); setTiles(createEmptyBoard(s)); setEditingId(null); setName('') }} style={{ accentColor:'#2563eb' }} />
            </div>
            <button onClick={newBoard} style={{ background:'rgba(255,255,255,0.07)', color:'#94a3b8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', padding:'7px 14px', cursor:'pointer', fontSize:'0.85rem', marginTop:'16px' }}>Clear</button>
          </div>
          <div style={{ color:'#64748b', fontSize:'0.78rem', marginBottom:'10px' }}>Rocks: {rockCount} ({rockPct}%) — max 20%</div>
          <BoardGrid tiles={tiles} size={size} onToggle={toggleTile} />
          {error && <div style={{ color:'#f87171', fontSize:'0.8rem', marginTop:'8px' }}>{error}</div>}
          <button onClick={handleSave} style={{ marginTop:'14px', background:'#2563eb', color:'white', border:'none', borderRadius:'7px', padding:'9px 20px', fontWeight:'600', cursor:'pointer' }}>{editingId ? 'Update Board' : 'Save Board'}</button>
          {editingId && <button onClick={() => { setEditingId(null); setTiles(createEmptyBoard(size)) }} style={{ marginTop:'14px', marginLeft:'8px', background:'rgba(255,255,255,0.05)', color:'#94a3b8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', padding:'9px 14px', cursor:'pointer' }}>Cancel</button>}
        </div>
        <div style={{ flex:1, minWidth:'220px' }}>
          <h2 style={{ color:'#e2e8f0', fontSize:'1.1rem', marginBottom:'14px' }}>Saved Boards ({savedBoards.length})</h2>
          {savedBoards.length === 0 ? <p style={{ color:'#64748b' }}>No boards yet.</p> :
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {sortedBoards.map(b => (
                <div key={b._id||b.id} style={{ background:'#1a2940', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ color:'#e2e8f0', fontSize:'0.88rem' }}>{b.name || `${b.size}×${b.size}`}</span>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={() => handleToggleFavorite(b._id||b.id)} style={{ background:'rgba(251,191,36,0.12)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.28)', borderRadius:'5px', padding:'4px 10px', cursor:'pointer', fontSize:'0.78rem' }}>{favoriteBoardIds.has(String(b._id||b.id)) ? '★' : '☆'}</button>
                    <button onClick={() => handleEdit(b)} style={{ background:'rgba(37,99,235,0.15)', color:'#60a5fa', border:'1px solid rgba(37,99,235,0.25)', borderRadius:'5px', padding:'4px 10px', cursor:'pointer', fontSize:'0.78rem' }}>Edit</button>
                    <button onClick={() => handleDelete(b._id||b.id)} style={{ background:'rgba(239,68,68,0.1)', color:'#f87171', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'5px', padding:'4px 10px', cursor:'pointer', fontSize:'0.78rem' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>}
        </div>
      </div>
    </div>
  )
}
