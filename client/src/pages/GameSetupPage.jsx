import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { rooms as roomsApi, ships as shipsApi, boards as boardsApi } from '../services/api'
import useSocket from '../hooks/useSocket'
import useGame from '../hooks/useGame'
import { createEmptyBoard } from '../utils/boardUtils.js'
import FleetPlacer from '../components/setup/FleetPlacer.jsx'

export default function GameSetupPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const socket = useSocket()
  const { setGameData } = useGame()
  const [room, setRoom] = useState(null)
  const [ships, setShips] = useState([])
  const [boardTiles, setBoardTiles] = useState(null)
  const [fleetAccepted, setFleetAccepted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    roomsApi.get(roomId).then(res => {
      const r = res.data
      setRoom(r)
      const templateId = r.settings?.boardTemplateId
      if (templateId) {
        boardsApi.get(templateId).then(br => setBoardTiles(br.data.tiles)).catch(() => {})
      }
    }).catch(() => {})
    shipsApi.list().then(res => setShips(res.data || [])).catch(() => {})
  }, [roomId])

  useEffect(() => {
    if (!socket || !roomId) return
    socket.emit('join_room', { roomId })
    const onFleetAccepted = () => setFleetAccepted(true)
    const onGameStart = (data) => { setGameData(data); navigate(`/game/${data.gameId}`) }
    const onRoomUpdate = ({ safeRoom }) => { if (safeRoom) setRoom(safeRoom) }
    const onError = ({ message }) => setError(message)
    socket.on('fleet_accepted', onFleetAccepted)
    socket.on('game_start', onGameStart)
    socket.on('room_update', onRoomUpdate)
    socket.on('error', onError)
    return () => {
      socket.off('fleet_accepted', onFleetAccepted)
      socket.off('game_start', onGameStart)
      socket.off('room_update', onRoomUpdate)
      socket.off('error', onError)
    }
  }, [socket, roomId, navigate, setGameData])

  const boardSize = room?.settings?.boardSize || 10
  const tiles = boardTiles || createEmptyBoard(boardSize)

  return (
    <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'32px 20px' }}>
      <h1 style={{ color:'#e2e8f0', marginBottom:'6px' }}>Fleet Placement</h1>
      {room && (
        <p style={{ color:'#64748b', fontSize:'0.85rem', marginBottom:'20px' }}>
          Room: {boardSize}×{boardSize} board · {room.settings?.turnTimeLimit}s turns · Players: {room.players?.length || 0}/2
        </p>
      )}
      {error && <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', color:'#f87171', padding:'10px 14px', borderRadius:'8px', marginBottom:'16px', fontSize:'0.875rem' }}>{error}</div>}
      {fleetAccepted ? (
        <div style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)', color:'#4ade80', padding:'20px', borderRadius:'10px', textAlign:'center', fontSize:'1.1rem' }}>
          ✓ Fleet placed! Waiting for opponent…
        </div>
      ) : (
        ships.length === 0 ? (
          <div style={{ color:'#64748b', padding:'20px' }}>
            You have no ships. <a href="/ships">Create ships first</a>, then come back.
          </div>
        ) : (
          <FleetPlacer
            boardSize={boardSize}
            boardTiles={tiles}
            availableShips={ships}
            onFleetReady={fleet => socket?.emit('place_fleet', { roomId, fleet })}
          />
        )
      )}
    </div>
  )
}
