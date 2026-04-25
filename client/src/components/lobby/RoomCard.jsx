export default function RoomCard({ room, onJoin, onOpenOwnRoom, onDeleteOwnRoom, currentUserId, deletingRoomId }) {
  const playerCount = room.players?.length || 0
  const isFull = playerCount >= 2
  const boardSize = room.settings?.boardSize || room.boardSize || 10
  const turnTimeLimit = room.settings?.turnTimeLimit || room.turnTimeLimit || 60
  const shipLimit = room.settings?.shipLimit || 5
  const roomId = room._id || room.id
  const hostName = room.hostId?.username || room.hostId?.email?.split('@')[0] || room.host?.username || room.host?.email?.split('@')[0] || 'Nieznany gospodarz'

  // Detect if current user is the host
  const hostId = room.hostId?._id || room.host?._id || room.host || room.hostId
  const isHost = hostId === currentUserId ||
    room.players?.[0]?.userId?._id === currentUserId ||
    room.players?.[0]?._id === currentUserId ||
    room.players?.[0] === currentUserId

  const hasPassword = room.hasPassword || !!room.password
  const isRanked = !!room.isRanked
  const statusColors = { waiting: '#22c55e', setup: '#38bdf8', in_game: '#f59e0b', finished: '#64748b' }
  const statusColor = statusColors[room.status] || '#94a3b8'
  const isDeleting = deletingRoomId === roomId

  return (
    <div style={cardStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ color: '#e2e8f0', fontWeight: '600', fontSize: '0.95rem' }}>
            Lobby {(roomId || '').slice(-6)}
          </span>
          {hasPassword && (
            <span title="Password protected" style={{ fontSize: '0.85rem' }}>🔒</span>
          )}
          <span style={{ color: statusColor, fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>
            {room.status || 'waiting'}
          </span>
          <span
            style={{
              color: isRanked ? '#fbbf24' : '#94a3b8',
              background: isRanked ? 'rgba(245,158,11,0.12)' : 'rgba(148,163,184,0.1)',
              border: isRanked ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(148,163,184,0.2)',
              fontSize: '0.68rem',
              fontWeight: 700,
              borderRadius: '999px',
              padding: '2px 7px',
            }}
          >
            {isRanked ? 'RANKED' : 'CASUAL'}
          </span>
        </div>
        <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '6px' }}>
          Założyciel: <span style={{ color: '#e2e8f0' }}>{hostName}</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', color: '#64748b', fontSize: '0.8rem', flexWrap: 'wrap' }}>
          <span>Plansza {boardSize}×{boardSize}</span>
          <span>Players {playerCount}/2</span>
          <span>Tura {turnTimeLimit}s</span>
          <span>Statki {shipLimit}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        {isHost ? (
          <>
            <button
              onClick={() => onOpenOwnRoom?.(room)}
              style={joinBtnStyle}
            >
              Otwórz
            </button>
            <button
              onClick={() => onDeleteOwnRoom?.(room)}
              disabled={isDeleting}
              style={{
                ...deleteBtnStyle,
                opacity: isDeleting ? 0.55 : 1,
                cursor: isDeleting ? 'not-allowed' : 'pointer',
              }}
            >
              {isDeleting ? 'Zamykanie…' : 'Zamknij lobby'}
            </button>
          </>
        ) : (
          <button
            onClick={() => onJoin(room)}
            disabled={isFull || room.status === 'in_game'}
            style={{
              ...joinBtnStyle,
              opacity: (isFull || room.status === 'in_game') ? 0.45 : 1,
              cursor: (isFull || room.status === 'in_game') ? 'not-allowed' : 'pointer',
            }}
          >
            {isFull ? 'Pełny' : room.status === 'in_game' ? 'W grze' : 'Dołącz'}
          </button>
        )}
      </div>
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

const deleteBtnStyle = {
  background: 'rgba(239,68,68,0.12)',
  color: '#fca5a5',
  border: '1px solid rgba(239,68,68,0.25)',
  borderRadius: '7px',
  padding: '8px 14px',
  fontSize: '0.82rem',
  fontWeight: '600',
}

