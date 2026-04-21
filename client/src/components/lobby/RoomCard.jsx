export default function RoomCard({ room, onJoin, currentUserId }) {
  const playerCount = room.players?.length || 0
  const isFull = playerCount >= 2

  // Detect if current user is the host
  const hostId = room.host?._id || room.host || room.hostId
  const isHost = hostId === currentUserId ||
    room.players?.[0]?._id === currentUserId ||
    room.players?.[0] === currentUserId

  const hasPassword = room.hasPassword || !!room.password
  const statusColors = { waiting: '#22c55e', playing: '#f59e0b', finished: '#64748b' }
  const statusColor = statusColors[room.status] || '#94a3b8'

  return (
    <div style={cardStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ color: '#e2e8f0', fontWeight: '600', fontSize: '0.95rem' }}>
            {room.host?.email || room.hostEmail || `Room ${(room._id || room.id || '').slice(-6)}`}
          </span>
          {hasPassword && (
            <span title="Password protected" style={{ fontSize: '0.85rem' }}>🔒</span>
          )}
          <span style={{ color: statusColor, fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>
            {room.status || 'waiting'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '16px', color: '#64748b', fontSize: '0.8rem', flexWrap: 'wrap' }}>
          <span>Board {room.boardSize}×{room.boardSize}</span>
          <span>Players {playerCount}/2</span>
          <span>Turn {room.turnTimeLimit}s</span>
        </div>
      </div>
      <button
        onClick={() => onJoin(room)}
        disabled={isFull || isHost || room.status === 'playing'}
        style={{
          ...joinBtnStyle,
          opacity: (isFull || isHost || room.status === 'playing') ? 0.45 : 1,
          cursor: (isFull || isHost || room.status === 'playing') ? 'not-allowed' : 'pointer',
        }}
      >
        {isHost ? 'Your Room' : isFull ? 'Full' : room.status === 'playing' ? 'In Progress' : 'Join'}
      </button>
    </div>
  )
}

const cardStyle = {
  background: '#1a2940',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
}

const joinBtnStyle = {
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '7px',
  padding: '8px 20px',
  fontSize: '0.875rem',
  fontWeight: '600',
  flexShrink: 0,
  cursor: 'pointer',
}
