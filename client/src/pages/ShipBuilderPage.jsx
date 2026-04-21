import { useState, useEffect } from 'react'
import { ships as shipsApi } from '../services/api'
import ShipGrid from '../components/ships/ShipGrid.jsx'
import ShipCard from '../components/ships/ShipCard.jsx'
import { isContiguous, getShipCells } from '../utils/boardUtils.js'

const EMPTY = () => Array.from({length:4}, () => Array(4).fill(0))

export default function ShipBuilderPage() {
  const [shape, setShape] = useState(EMPTY())
  const [abilityType, setAbilityType] = useState('linear')
  const [savedShips, setSavedShips] = useState([])
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)

  useEffect(() => { loadShips() }, [])

  async function loadShips() {
    try { const res = await shipsApi.list(); setSavedShips(res.data || []) } catch {}
  }

  function toggle(r, c) {
    const s = shape.map(row => [...row])
    s[r][c] = s[r][c] === 1 ? 0 : 1
    setShape(s)
  }

  async function handleSave() {
    setError('')
    const cells = getShipCells(shape)
    if (cells.length === 0) return setError('Ship must have at least 1 cell')
    if (cells.length > 7) return setError('Max 7 cells')
    if (!isContiguous(shape)) return setError('Cells must be connected')
    try {
      if (editingId) await shipsApi.update(editingId, { shape, abilityType })
      else await shipsApi.create({ shape, abilityType })
      await loadShips(); setShape(EMPTY()); setEditingId(null)
    } catch (err) { setError(err.response?.data?.message || 'Save failed') }
  }

  async function handleDelete(id) {
    try { await shipsApi.delete(id); await loadShips() } catch {}
  }

  function handleEdit(ship) { setShape(ship.shape); setAbilityType(ship.abilityType || 'linear'); setEditingId(ship._id || ship.id) }

  const inp = { width:'100%', background:'#0f1923', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'7px', padding:'9px 12px', color:'#e2e8f0', fontSize:'0.9rem' }

  return (
    <div style={{ maxWidth:'900px', margin:'0 auto', padding:'32px 20px' }}>
      <h1 style={{ color:'#e2e8f0', marginBottom:'24px' }}>Ship Builder</h1>
      <div style={{ display:'flex', gap:'32px', flexWrap:'wrap', alignItems:'flex-start' }}>
        <div style={{ background:'#1a2940', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'24px', minWidth:'220px' }}>
          <h2 style={{ color:'#e2e8f0', fontSize:'1.1rem', marginBottom:'16px' }}>{editingId ? 'Edit Ship' : 'New Ship'}</h2>
          <p style={{ color:'#64748b', fontSize:'0.78rem', marginBottom:'10px' }}>Click cells to toggle (max 7, must be connected)</p>
          <ShipGrid shape={shape} onToggle={toggle} />
          <div style={{ marginTop:'16px', marginBottom:'16px' }}>
            <label style={{ display:'block', color:'#94a3b8', fontSize:'0.82rem', marginBottom:'6px' }}>Ability Type</label>
            <select value={abilityType} onChange={e => setAbilityType(e.target.value)} style={inp}>
              <option value="linear">Linear</option>
              <option value="random">Random</option>
              <option value="target">Target (3 tiles)</option>
              <option value="sonar">Sonar</option>
            </select>
          </div>
          <div style={{ color:'#64748b', fontSize:'0.78rem', marginBottom:'12px' }}>Cells: {getShipCells(shape).length}/7</div>
          {error && <div style={{ color:'#f87171', fontSize:'0.8rem', marginBottom:'10px' }}>{error}</div>}
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={handleSave} style={{ background:'#2563eb', color:'white', border:'none', borderRadius:'7px', padding:'9px 18px', fontWeight:'600', cursor:'pointer' }}>{editingId ? 'Update' : 'Save'}</button>
            {editingId && <button onClick={() => { setEditingId(null); setShape(EMPTY()) }} style={{ background:'rgba(255,255,255,0.05)', color:'#94a3b8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'7px', padding:'9px 14px', cursor:'pointer' }}>Cancel</button>}
          </div>
        </div>
        <div style={{ flex:1, minWidth:'260px' }}>
          <h2 style={{ color:'#e2e8f0', fontSize:'1.1rem', marginBottom:'14px' }}>My Ships ({savedShips.length})</h2>
          {savedShips.length === 0 ? <p style={{ color:'#64748b' }}>No ships yet.</p> :
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {savedShips.map(s => <ShipCard key={s._id||s.id} ship={s} onDelete={handleDelete} onEdit={handleEdit} />)}
            </div>}
        </div>
      </div>
    </div>
  )
}
