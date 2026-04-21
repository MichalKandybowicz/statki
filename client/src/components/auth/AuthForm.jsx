import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function AuthForm({ type, onSubmit, error, loading }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(email, password)
  }

  const isLogin = type === 'login'

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <h2 style={{ color: '#e2e8f0', marginBottom: '8px', fontSize: '1.6rem', fontWeight: '700' }}>
        {isLogin ? 'Sign In' : 'Create Account'}
      </h2>
      <p style={{ color: '#64748b', marginBottom: '28px', fontSize: '0.9rem' }}>
        {isLogin ? 'Welcome back!' : 'Join the battle.'}
      </p>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={fieldStyle}>
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={inputStyle}
          placeholder="you@example.com"
        />
      </div>

      <div style={{ ...fieldStyle, marginBottom: '28px' }}>
        <label style={labelStyle}>Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          style={inputStyle}
          placeholder="••••••••"
        />
      </div>

      <button type="submit" disabled={loading} style={submitBtnStyle}>
        {loading ? 'Loading…' : isLogin ? 'Sign In' : 'Register'}
      </button>

      <p style={{ marginTop: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
        {isLogin ? (
          <>Don&apos;t have an account?{' '}<Link to="/register">Register</Link></>
        ) : (
          <>Already have an account?{' '}<Link to="/login">Sign in</Link></>
        )}
      </p>
    </form>
  )
}

const formStyle = {
  background: '#1a2940',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '14px',
  padding: '36px',
  width: '100%',
  maxWidth: '420px',
}

const fieldStyle = {
  marginBottom: '18px',
}

const labelStyle = {
  display: 'block',
  color: '#94a3b8',
  fontSize: '0.85rem',
  fontWeight: '500',
  marginBottom: '6px',
}

const inputStyle = {
  width: '100%',
  background: '#0f1923',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '8px',
  padding: '11px 14px',
  color: '#e2e8f0',
  fontSize: '0.95rem',
  outline: 'none',
}

const submitBtnStyle = {
  width: '100%',
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  padding: '12px',
  fontSize: '1rem',
  fontWeight: '600',
  cursor: 'pointer',
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
