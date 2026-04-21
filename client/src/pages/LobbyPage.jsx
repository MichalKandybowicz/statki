import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { rooms as roomsApi } from '../services/api'
import useAuth from '../hooks/useAuth'
import useSocket from '../hooks/useSocket'
import RoomList from '../components/lobby/RoomList.jsx'
import CreateRoomModal from '../components/lobby/CreateRoomModal.jsx'

export default function LobbyPage() {
  const [roomsList, setRoomsList] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const { user } = useAuth()
  const socket = useSocket()
  const navigate = useNavigate()

  const fetchRooms = useCallback(async () => {
    try { const res = await roomsApi.list(); setRoomsList(res.data || []) } catch {}
  }, [])

  useEffect(() => {
    fetchRooms()
    const iv = setInterval(fetchRooms, 5000)
    return () => clearInterval(iv)
  }, [fetchRooms])

  useEffect(() => {
    if (!socket) return
    socket.on('room_update', fetchRooms)
    return () => socket.off('room_update', fetchRooms)
  }, [socket, fetchRooms])

  async function handleCreate(data) {
    setCreateLoading(true); setCreateError('')
    try {
      const res = await roomsApi.create(data)
      const room = res.data
      setShowModal(false)
      socket?.emit('join_room', { roomId: room._id || room.id })
      navigate(`/room/${room._id || room.id}/setup`)
    } catch (err) { setCreateError(err.response?.data?.message || 'Failed to create room') }
    finally { setCreateLoading(false) }
  }

  function handleJoin(room) {
    const roomId = room._id || room.id
    const pw = (room.hasPassword || room.password) ? prompt('Enter room password:') : undefined
    socket?.emit('join_room', { roomId, password: pw })
    navigate(`/room/${roomId}/setup`)
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <h1 style={{ color:'#e2e8f0', fontSize:'1.6rem', fontWeight:'700' }}>Game Lobby</h1>
        <button onClick={() => setShowModal(true)} style={{ background:'#2563eb', color:'white', border:'none', borderRadius:'8px', padding:'10px 20px', fontWeight:'600', cursor:'pointer' }}>+ Create Room</button>
      </div>
      <RoomList rooms={roomsList} onJoin={handleJoin} currentUserId={user?._id} />
      {showModal && <CreateRoomModal onClose={() => setShowModal(false)} onSubmit={handleCreate} loading={createLoading} error={createError} />}
    </div>
  )
}
