export default function RoomCard({ room, onJoin, currentUserId }) {
  const playerCount = room.players?.length || 0
  const isFull = playerCount >= 2
  const boardSize = room.settings?.boardSize || room.boardSize || 10
  const turnTimeLimit = room.settings?.turnTimeLimit || room.turnTimeLimit || 60
  const shipLimit = room.settings?.shipLimit || 5

  // Detect if current user is the host
  const hostId = room.hostId?._id || room.host?._id || room.host || room.hostId
  const isHost = hostId === currentUserId ||
    room.players?.[0]?.userId?._id === currentUserId ||
    room.players?.[0]?._id === currentUserId ||
    room.players?.[0] === currentUserId

  const hasPassword = room.hasPassword || !!room.password
  const statusColors = { waiting: '#22c55e', setup: '#38bdf8', in_game: '#f59e0b', finished: '#64748b' }
  const statusColor = statusColors[room.status] || '#94a3b8'

  return (
    <div style={cardStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ color: '#e2e8f0', fontWeight: '600', fontSize: '0.95rem' }}>
            {room.hostId?.email || room.host?.email || room.hostEmail || `Room ${(room._id || room.id || '').slice(-6)}`}
          </span>
          {hasPassword && (
            <span title="Password protected" style={{ fontSize: '0.85rem' }}>🔒</span>
          )}
          <span style={{ color: statusColor, fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>
            {room.status || 'waiting'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '16px', color: '#64748b', fontSize: '0.8rem', flexWrap: 'wrap' }}>
          <span>Plansza {boardSize}×{boardSize}</span>
          <span>Players {playerCount}/2</span>
          <span>Tura {turnTimeLimit}s</span>
          <span>Statki {shipLimit}</span>
        </div>
      </div>
      <button
        onClick={() => onJoin(room)}
        disabled={isFull || isHost || room.status === 'in_game'}
        style={{
          ...joinBtnStyle,
          opacity: (isFull || isHost || room.status === 'in_game') ? 0.45 : 1,
          cursor: (isFull || isHost || room.status === 'in_game') ? 'not-allowed' : 'pointer',
        }}
      >
        {isHost ? 'Twój pokój' : isFull ? 'Pełny' : room.status === 'in_game' ? 'W grze' : 'Dołącz'}
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
