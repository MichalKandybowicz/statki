import { useState, useEffect } from 'react'
import { boards as boardsApi } from '../../services/api'

export default function CreateRoomModal({ onClose, onSubmit, loading, error }) {
  const [boardSize, setBoardSize] = useState(10)
  const [turnTimeLimit, setTurnTimeLimit] = useState(60)
  const [password, setPassword] = useState('')
  const [boardTemplateId, setBoardTemplateId] = useState('')
  const [availableBoards, setAvailableBoards] = useState([])

  useEffect(() => {
    boardsApi.list().then(res => {
      setAvailableBoards(res.data || [])
    }).catch(() => {})
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const data = { boardSize, turnTimeLimit }
    if (password) data.password = password
    if (boardTemplateId) data.boardTemplateId = boardTemplateId
    onSubmit(data)
  }

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '1.3rem' }}>Create Room</h2>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <label style={labelStyle}>
              Board Size: <strong style={{ color: '#60a5fa' }}>{boardSize}×{boardSize}</strong>
            </label>
            <input
              type="range" min="10" max="25" value={boardSize}
              onChange={e => setBoardSize(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#2563eb' }}
            />
            <div style={rangeHintsStyle}><span>10</span><span>25</span></div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>
              Turn Time Limit: <strong style={{ color: '#60a5fa' }}>{turnTimeLimit}s</strong>
            </label>
            <input
              type="range" min="10" max="300" step="10" value={turnTimeLimit}
              onChange={e => setTurnTimeLimit(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#2563eb' }}
            />
            <div style={rangeHintsStyle}><span>10s</span><span>5min</span></div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Password (optional)</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="Leave blank for public room"
            />
          </div>

          {availableBoards.length > 0 && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Board Template (optional)</label>
              <select
                value={boardTemplateId}
                onChange={e => setBoardTemplateId(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">No template (empty board)</option>
                {availableBoards.map(b => (
                  <option key={b._id || b.id} value={b._id || b.id}>
                    {b.name || `${b.size}×${b.size} board`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
            <button type="submit" disabled={loading} style={submitBtnStyle}>
              {loading ? 'Creating…' : 'Create Room'}
            </button>
          </div>
        </form>
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
