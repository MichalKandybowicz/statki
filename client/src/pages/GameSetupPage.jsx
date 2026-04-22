import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { rooms as roomsApi, ships as shipsApi, boards as boardsApi } from '../services/api'
import useSocket from '../hooks/useSocket'
import useGame from '../hooks/useGame'
import useAuth from '../hooks/useAuth'
import { createEmptyBoard } from '../utils/boardUtils.js'
import FleetPlacer from '../components/setup/FleetPlacer.jsx'

export default function GameSetupPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const socket = useSocket()
  const { setGameData } = useGame()
  const { user } = useAuth()

  const [room, setRoom] = useState(null)
  const [ships, setShips] = useState([])
  const [boardTiles, setBoardTiles] = useState(null)
  const [error, setError] = useState('')
  const [boardLoading, setBoardLoading] = useState(true)
  const [startingGame, setStartingGame] = useState(false)
  const [myBoards, setMyBoards] = useState([])
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [changingMap, setChangingMap] = useState(false)

  useEffect(() => {
    roomsApi.get(roomId)
      .then(res => setRoom(res.data))
      .catch(err => setError(err.response?.data?.error || 'Nie udało się pobrać pokoju'))

    shipsApi.list()
      .then(res => setShips(res.data || []))
      .catch(() => setShips([]))

    boardsApi.list()
      .then(res => setMyBoards(res.data || []))
      .catch(() => setMyBoards([]))
  }, [roomId])

  useEffect(() => {
    const templateId = room?.settings?.boardTemplateId
    if (!templateId) {
      setBoardTiles(null)
      setBoardLoading(false)
      return
    }

    setBoardLoading(true)
    boardsApi.get(templateId)
      .then(res => setBoardTiles(res.data.tiles || null))
      .catch(() => {
        setBoardTiles(null)
        setError(prev => prev || 'Nie udało się załadować wybranej planszy')
      })
      .finally(() => setBoardLoading(false))
  }, [room?.settings?.boardTemplateId])

  useEffect(() => {
    if (!socket || !roomId) return

    socket.emit('join_room', { roomId })

    const onFleetAccepted = () => setError('')
    const onGameStart = (data) => {
      setStartingGame(false)
      setGameData(data)
      navigate(`/game/${data.gameId}`)
    }
    const onRoomUpdate = (updatedRoom) => {
      setRoom(updatedRoom)
      setStartingGame(false)
      setChangingMap(false)
    }
    const onError = ({ message }) => {
      setStartingGame(false)
      setChangingMap(false)
      setError(message)
    }
    const onMapChanged = () => {
      setShowMapPicker(false)
      setChangingMap(false)
    }

    socket.on('fleet_accepted', onFleetAccepted)
    socket.on('game_start', onGameStart)
    socket.on('room_update', onRoomUpdate)
    socket.on('error', onError)
    socket.on('map_changed', onMapChanged)

    return () => {
      socket.off('fleet_accepted', onFleetAccepted)
      socket.off('game_start', onGameStart)
      socket.off('room_update', onRoomUpdate)
      socket.off('error', onError)
      socket.off('map_changed', onMapChanged)
    }
  }, [socket, roomId, navigate, setGameData])

  const boardSize = room?.settings?.boardSize || 10
  const shipLimit = room?.settings?.shipLimit || 5
  const tiles = boardTiles || createEmptyBoard(boardSize)

  const uniquePlayers = useMemo(() => {
    const map = new Map()
    for (const player of room?.players || []) {
      const id = (player.userId?._id || player.userId)?.toString()
      if (!id) continue
      if (!map.has(id)) {
        map.set(id, player)
        continue
      }
      if (player.ready) {
        map.set(id, { ...map.get(id), ...player, ready: true })
      }
    }
    return Array.from(map.values())
  }, [room?.players])

  const currentPlayer = useMemo(
    () => uniquePlayers.find((player) => (player.userId?._id || player.userId)?.toString() === user?._id?.toString()),
    [uniquePlayers, user?._id]
  )

  const isHost = (room?.hostId?._id || room?.hostId)?.toString() === user?._id?.toString()
  const isReady = !!currentPlayer?.ready
  const playersReady = uniquePlayers.filter(player => player.ready).length
  const canStartGame = isHost && uniquePlayers.length === 2 && playersReady === 2 && room?.status !== 'in_game'

  function handleStartGame() {
    if (!socket || !canStartGame) return
    setStartingGame(true)
    setError('')
    socket.emit('start_game', { roomId })
  }

  function handleChangeMap(boardTemplateId) {
    if (!socket) return
    setChangingMap(true)
    setError('')
    socket.emit('change_map', { roomId, boardTemplateId })
  }

  return (
    <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'32px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:'20px', alignItems:'flex-start', flexWrap:'wrap', marginBottom:'20px' }}>
        <div>
          <h1 style={{ color:'#e2e8f0', marginBottom:'6px' }}>Ustawianie floty</h1>
          {room && (
            <p style={{ color:'#64748b', fontSize:'0.85rem' }}>
              Plansza: {boardSize}×{boardSize} · Limit statków: {shipLimit} · Tura: {room.settings?.turnTimeLimit}s
            </p>
          )}
        </div>

        <div style={sideCardStyle}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
            <h2 style={{ color:'#e2e8f0', fontSize:'1rem', margin:0 }}>Gracze</h2>
            <span style={{ color:'#64748b', fontSize:'0.8rem' }}>{playersReady}/{uniquePlayers.length || 0} gotowych</span>
          </div>

          <div style={{ display:'grid', gap:'8px' }}>
            {uniquePlayers.map((player, idx) => {
              const playerId = (player.userId?._id || player.userId)?.toString()
              const isPlayerHost = playerId === (room?.hostId?._id || room?.hostId)?.toString()
              return (
                <div key={playerId || idx} style={playerRowStyle}>
                  <div>
                    <div style={{ color:'#e2e8f0', fontSize:'0.9rem', fontWeight:600 }}>
                      {player.userId?.username || player.userId?.email?.split('@')[0] || `Gracz ${idx + 1}`}
                      {isPlayerHost && <span style={hostBadgeStyle}>HOST</span>}
                      {playerId === user?._id?.toString() && <span style={meBadgeStyle}>TY</span>}
                    </div>
                  </div>
                  <span style={{ color: player.ready ? '#4ade80' : '#f59e0b', fontSize:'0.8rem', fontWeight:700 }}>
                    {player.ready ? 'GOTOWY' : 'CZEKA'}
                  </span>
                </div>
              )
            })}
          </div>

          {isHost ? (
            <>
              <button
                onClick={handleStartGame}
                disabled={!canStartGame || startingGame}
                style={{
                  ...startBtnStyle,
                  opacity: canStartGame && !startingGame ? 1 : 0.45,
                  cursor: canStartGame && !startingGame ? 'pointer' : 'not-allowed',
                }}
              >
                {startingGame ? 'Uruchamianie…' : 'Start gry'}
              </button>
              <button
                onClick={() => setShowMapPicker(p => !p)}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  background: 'rgba(37,99,235,0.12)',
                  color: '#60a5fa',
                  border: '1px solid rgba(37,99,235,0.25)',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {showMapPicker ? 'Ukryj wybór mapy' : '🗺 Zmień mapę'}
              </button>
              {showMapPicker && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {myBoards.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>Brak dostępnych map.</p>
                  ) : myBoards.map(b => {
                    const bid = b._id || b.id
                    const isActive = (room?.settings?.boardTemplateId === bid || room?.settings?.boardTemplateId?._id === bid || room?.settings?.boardTemplateId?.toString() === bid)
                    return (
                      <button
                        key={bid}
                        onClick={() => !isActive && handleChangeMap(bid)}
                        disabled={changingMap || isActive}
                        style={{
                          background: isActive ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                          color: isActive ? '#4ade80' : '#cbd5e1',
                          border: isActive ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '7px',
                          padding: '8px 12px',
                          cursor: isActive || changingMap ? 'default' : 'pointer',
                          fontSize: '0.82rem',
                          textAlign: 'left',
                          opacity: changingMap && !isActive ? 0.55 : 1,
                        }}
                      >
                        {b.name || `Mapa ${(bid || '').slice(-5)}`} — {b.size || b.boardSize || '?'}×{b.size || b.boardSize || '?'}
                        {isActive && ' ✓'}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <p style={{ color:'#64748b', fontSize:'0.8rem', marginTop:'12px', marginBottom:0 }}>
              Tylko lider pokoju może wystartować grę, gdy obaj gracze są gotowi.
            </p>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', color:'#f87171', padding:'10px 14px', borderRadius:'8px', marginBottom:'16px', fontSize:'0.875rem' }}>
          {error}
        </div>
      )}

      {boardLoading ? (
        <div style={infoBoxStyle}>Ładowanie planszy…</div>
      ) : ships.length === 0 ? (
        <div style={infoBoxStyle}>
          Nie masz żadnych statków. <a href="/ships">Stwórz je najpierw</a>, a potem wróć tutaj.
        </div>
      ) : isReady ? (
        <div style={infoBoxStyle}>
          ✓ Twoja flota została zatwierdzona. {canStartGame ? 'Możesz rozpocząć grę.' : 'Czekaj na drugiego gracza lub na start hosta.'}
        </div>
      ) : (
        <FleetPlacer
          boardSize={boardSize}
          boardTiles={tiles}
          availableShips={ships}
          shipLimit={shipLimit}
          onFleetReady={fleet => {
            setError('')
            socket?.emit('place_fleet', { roomId, fleet })
          }}
        />
      )}
    </div>
  )
}

const sideCardStyle = {
  width: '100%',
  maxWidth: '360px',
  background: '#162438',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  padding: '16px',
}

const playerRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: '#0f1923',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '8px',
  padding: '10px 12px',
}

const hostBadgeStyle = {
  marginLeft: '8px',
  fontSize: '0.65rem',
  color: '#60a5fa',
  background: 'rgba(37,99,235,0.15)',
  border: '1px solid rgba(37,99,235,0.28)',
  borderRadius: '999px',
  padding: '2px 6px',
}

const meBadgeStyle = {
  marginLeft: '6px',
  fontSize: '0.65rem',
  color: '#cbd5e1',
  background: 'rgba(255,255,255,0.08)',
  borderRadius: '999px',
  padding: '2px 6px',
}

const startBtnStyle = {
  marginTop: '12px',
  width: '100%',
  background: '#16a34a',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  padding: '10px 14px',
  fontSize: '0.92rem',
  fontWeight: 700,
}

const infoBoxStyle = {
  background:'rgba(34,197,94,0.08)',
  border:'1px solid rgba(255,255,255,0.1)',
  color:'#cbd5e1',
  padding:'20px',
  borderRadius:'10px',
  textAlign:'center',
  fontSize:'1rem',
}
