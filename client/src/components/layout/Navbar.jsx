import { Link, useLocation } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()

  if (location.pathname.startsWith('/game/')) return null

  return (
    <nav style={navStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <Link to="/" style={brandStyle}>⚓ Statki</Link>
        {user && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <NavLink to="/">Lobby</NavLink>
            <NavLink to="/ships">My Ships</NavLink>
            <NavLink to="/boards">My Boards</NavLink>
          </div>
        )}
      </div>
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{user.email}</span>
          <button onClick={logout} style={logoutBtnStyle}>Logout</button>
        </div>
      )}
    </nav>
  )
}

function NavLink({ to, children }) {
  const location = useLocation()
  const active = location.pathname === to
  return (
    <Link
      to={to}
      style={{
        color: active ? '#60a5fa' : '#94a3b8',
        textDecoration: 'none',
        fontSize: '0.9rem',
        padding: '6px 12px',
        borderRadius: '6px',
        background: active ? 'rgba(96,165,250,0.08)' : 'transparent',
        fontWeight: active ? '600' : '400',
      }}
    >
      {children}
    </Link>
  )
}

const navStyle = {
  background: '#1a2940',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  padding: '0 24px',
  height: '60px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'sticky',
  top: 0,
  zIndex: 100,
}

const brandStyle = {
  color: '#60a5fa',
  fontSize: '1.4rem',
  fontWeight: '700',
  textDecoration: 'none',
  letterSpacing: '-0.01em',
}

const logoutBtnStyle = {
  background: 'rgba(239,68,68,0.15)',
  color: '#f87171',
  border: '1px solid rgba(239,68,68,0.25)',
  padding: '6px 14px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: '500',
}
