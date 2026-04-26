import RoomCard from './RoomCard.jsx'

export default function RoomList({ rooms, onJoin, onOpenOwnRoom, onDeleteOwnRoom, currentUserId, deletingRoomId, loading = false, onCreate }) {
  if (loading) {
    return (
      <div style={{ display: 'grid', gap: '10px' }}>
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} style={{ background: '#1a2940', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px 20px', color: '#64748b', fontSize: '0.9rem' }}>
            Ładowanie lobby…
          </div>
        ))}
      </div>
    )
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#64748b', padding: '56px 0', fontSize: '0.95rem' }}>
        <div style={{ marginBottom: '10px' }}>Brak aktywnych lobby.</div>
        <button
          type='button'
          onClick={onCreate}
          style={{ background: 'rgba(37,99,235,0.15)', color: '#93c5fd', border: '1px solid rgba(37,99,235,0.3)', borderRadius: '7px', padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem' }}
        >
          Stwórz pierwsze lobby
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {rooms.map(room => (
        <RoomCard
          key={room._id || room.id}
          room={room}
          onJoin={onJoin}
          onOpenOwnRoom={onOpenOwnRoom}
          onDeleteOwnRoom={onDeleteOwnRoom}
          currentUserId={currentUserId}
          deletingRoomId={deletingRoomId}
        />
      ))}
    </div>
  )
}
