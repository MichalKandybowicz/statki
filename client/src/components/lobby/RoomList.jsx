import RoomCard from './RoomCard.jsx'

export default function RoomList({ rooms, onJoin, onOpenOwnRoom, onDeleteOwnRoom, currentUserId, deletingRoomId }) {
  if (!rooms || rooms.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        color: '#64748b',
        padding: '60px 0',
        fontSize: '0.95rem',
      }}>
        No rooms available. Create one to get started!
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
