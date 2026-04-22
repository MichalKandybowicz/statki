import { useState } from 'react'
import useAuth from '../../hooks/useAuth'

export default function SettingsModal({ onClose }) {
  const { user, updateProfile } = useAuth()

  const [username, setUsername] = useState(user?.username || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [usernameStatus, setUsernameStatus] = useState(null) // null | 'ok' | 'error'
  const [usernameMsg, setUsernameMsg] = useState('')
  const [passwordStatus, setPasswordStatus] = useState(null)
  const [passwordMsg, setPasswordMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSaveUsername(e) {
    e.preventDefault()
    const trimmed = username.trim()
    if (!trimmed) { setUsernameStatus('error'); setUsernameMsg('Nick nie może być pusty'); return }
    setLoading(true); setUsernameStatus(null); setUsernameMsg('')
    try {
      await updateProfile({ username: trimmed })
      setUsernameStatus('ok'); setUsernameMsg('Nick został zmieniony')
    } catch (err) {
      setUsernameStatus('error')
      setUsernameMsg(err.response?.data?.error || 'Nie udało się zmienić nicku')
    } finally { setLoading(false) }
  }

  async function handleSavePassword(e) {
    e.preventDefault()
    if (!currentPassword) { setPasswordStatus('error'); setPasswordMsg('Podaj aktualne hasło'); return }
    if (newPassword.length < 6) { setPasswordStatus('error'); setPasswordMsg('Nowe hasło musi mieć min. 6 znaków'); return }
    if (newPassword !== confirmPassword) { setPasswordStatus('error'); setPasswordMsg('Hasła nie są takie same'); return }
    setLoading(true); setPasswordStatus(null); setPasswordMsg('')
    try {
      await updateProfile({ currentPassword, newPassword })
      setPasswordStatus('ok'); setPasswordMsg('Hasło zostało zmienione')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (err) {
      setPasswordStatus('error')
      setPasswordMsg(err.response?.data?.error || 'Nie udało się zmienić hasła')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#1a2940', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'14px', padding:'28px', width:'100%', maxWidth:'420px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <h2 style={{ color:'#e2e8f0', fontSize:'1.2rem', fontWeight:700, margin:0 }}>Ustawienia</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:'1.2rem', lineHeight:1 }}>✕</button>
        </div>

        <div style={{ color:'#64748b', fontSize:'0.78rem', marginBottom:'16px' }}>Konto: <span style={{ color:'#94a3b8' }}>{user?.email}</span></div>

        {/* Nick */}
        <form onSubmit={handleSaveUsername}>
          <div style={{ marginBottom:'10px' }}>
            <label style={labelStyle}>Nick</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={32}
              placeholder="Twój nick w grze"
              style={inputStyle}
            />
          </div>
          {usernameMsg && (
            <div style={{ color: usernameStatus === 'ok' ? '#4ade80' : '#f87171', fontSize:'0.8rem', marginBottom:'8px' }}>{usernameMsg}</div>
          )}
          <button type="submit" disabled={loading} style={{ ...btnStyle, marginBottom:'24px' }}>
            {loading ? 'Zapisywanie…' : 'Zmień nick'}
          </button>
        </form>

        <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:'20px' }}>
          <div style={{ color:'#94a3b8', fontSize:'0.85rem', fontWeight:600, marginBottom:'14px' }}>Zmiana hasła</div>

          <form onSubmit={handleSavePassword}>
            <div style={{ marginBottom:'10px' }}>
              <label style={labelStyle}>Aktualne hasło</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" style={inputStyle} placeholder="••••••••" />
            </div>
            <div style={{ marginBottom:'10px' }}>
              <label style={labelStyle}>Nowe hasło</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" style={inputStyle} placeholder="min. 6 znaków" />
            </div>
            <div style={{ marginBottom:'10px' }}>
              <label style={labelStyle}>Powtórz nowe hasło</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" style={inputStyle} placeholder="••••••••" />
            </div>
            {passwordMsg && (
              <div style={{ color: passwordStatus === 'ok' ? '#4ade80' : '#f87171', fontSize:'0.8rem', marginBottom:'8px' }}>{passwordMsg}</div>
            )}
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? 'Zapisywanie…' : 'Zmień hasło'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

const labelStyle = { display:'block', color:'#94a3b8', fontSize:'0.82rem', marginBottom:'5px' }
const inputStyle = {
  width:'100%', boxSizing:'border-box',
  background:'#0f1923', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'8px',
  padding:'9px 12px', color:'#e2e8f0', fontSize:'0.9rem',
}
const btnStyle = {
  width:'100%', background:'#2563eb', color:'white', border:'none',
  borderRadius:'8px', padding:'10px', fontWeight:700, cursor:'pointer', fontSize:'0.9rem',
}

