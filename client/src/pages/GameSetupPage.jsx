import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { rooms as roomsApi, ships as shipsApi, boards as boardsApi } from '../services/api'
import useSocket from '../hooks/useSocket'
import useGame from '../hooks/useGame'
import useAuth from '../hooks/useAuth'
import { createEmptyBoard } from '../utils/boardUtils.js'
import FleetPlacer from '../components/setup/FleetPlacer.jsx'
import PlacedFleetSummary from '../components/setup/PlacedFleetSummary.jsx'

export default function GameSetupPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const socket = useSocket()
  const { setGameData } = useGame()
  const { user } = useAuth()

  const [room, setRoom] = useState(null)
  const [ownShips, setOwnShips] = useState([])
  const [communityShips, setCommunityShips] = useState([])
  const [shipsLoading, setShipsLoading] = useState(true)
  const [shipsLoadError, setShipsLoadError] = useState('')
  const [boardTiles, setBoardTiles] = useState(null)
  const [error, setError] = useState('')
  const [boardLoading, setBoardLoading] = useState(true)
  const [startingGame, setStartingGame] = useState(false)
  const [availableBoards, setAvailableBoards] = useState([])
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [changingMap, setChangingMap] = useState(false)
  const [myFleet, setMyFleet] = useState([])
  const [shipLimitInput, setShipLimitInput] = useState(5)
  const [shipSearch, setShipSearch] = useState('')
  const [shipAbilityFilter, setShipAbilityFilter] = useState('all')
  const [includeCommunityShips, setIncludeCommunityShips] = useState(true)
  const [localPlacedShips, setLocalPlacedShips] = useState([])

  useEffect(() => {
    roomsApi.get(roomId)
      .then(res => setRoom(res.data))
      .catch(err => setError(err.response?.data?.error || 'Nie udało się pobrać pokoju'))

    loadShipsCatalog()

    Promise.allSettled([boardsApi.list(), boardsApi.listCommunity()])
      .then(([ownRes, communityRes]) => {
        const own = ownRes.status === 'fulfilled' ? (ownRes.value.data || []) : []
        const community = communityRes.status === 'fulfilled' ? (communityRes.value.data || []) : []
        const map = new Map()

        own.forEach((b) => {
          const id = String(b._id || b.id)
          if (!id) return
          map.set(id, { ...b, source: 'own' })
        })
        community.forEach((b) => {
          const id = String(b._id || b.id)
          if (!id || map.has(id)) return
          map.set(id, { ...b, source: 'community' })
        })

        setAvailableBoards(Array.from(map.values()))
      })
      .catch(() => setAvailableBoards([]))
  }, [roomId])

  async function loadShipsCatalog() {
    setShipsLoading(true)
    setShipsLoadError('')
    console.log('[GameSetupPage] loading ships catalog...')
    const [ownRes, communityRes] = await Promise.allSettled([shipsApi.list(), shipsApi.listCommunity()])

    const own = ownRes.status === 'fulfilled' ? (ownRes.value.data || []) : []
    const community = communityRes.status === 'fulfilled' ? (communityRes.value.data || []) : []

    console.log('[GameSetupPage] ships catalog result', {
      ownStatus: ownRes.status,
      ownCount: own.length,
      communityStatus: communityRes.status,
      communityCount: community.length,
    })

    setOwnShips(own)
    setCommunityShips(community)

    if (ownRes.status !== 'fulfilled' && communityRes.status !== 'fulfilled') {
      setShipsLoadError('Nie udało się pobrać listy statków. Odśwież listę i spróbuj ponownie.')
      console.error('[GameSetupPage] both ship requests failed', {
        ownReason: ownRes.reason,
        communityReason: communityRes.reason,
      })
    } else if (ownRes.status !== 'fulfilled') {
      setShipsLoadError('Nie udało się pobrać Twoich statków. Możesz nadal użyć statków społeczności.')
      console.warn('[GameSetupPage] own ships failed, community ships still available', {
        ownReason: ownRes.reason,
      })
    }

    setShipsLoading(false)
  }

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
      setShipLimitInput(updatedRoom.settings?.shipLimit || 5)
      // Restore staged fleet if available
      if (updatedRoom.stagedFleets && updatedRoom.stagedFleets[user?._id]) {
        setMyFleet(updatedRoom.stagedFleets[user?._id])
      }
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
  }, [socket, roomId, navigate, setGameData, user?._id])

  const boardSize = room?.settings?.boardSize || 10
  const shipLimit = room?.settings?.shipLimit || 5
  const tiles = boardTiles || createEmptyBoard(boardSize)

  const availableShips = useMemo(() => {
    const map = new Map()
    for (const ship of ownShips || []) {
      const id = String(ship._id || ship.id)
      if (!id) continue
      map.set(id, { ...ship, isOwn: true })
    }
    if (includeCommunityShips) {
      for (const ship of communityShips || []) {
        const id = String(ship._id || ship.id)
        if (!id || map.has(id)) continue
        map.set(id, { ...ship, isOwn: false })
      }
    }
    return Array.from(map.values())
  }, [ownShips, communityShips, includeCommunityShips])

  const filteredShips = useMemo(() => {
    const q = shipSearch.trim().toLowerCase()
    return availableShips.filter((ship) => {
      if (shipAbilityFilter !== 'all' && ship.abilityType !== shipAbilityFilter) return false
      if (!q) return true
      const ownerName = ship.owner?.username || ship.owner?.email?.split('@')[0] || ''
      return (ship.name || '').toLowerCase().includes(q) || ownerName.toLowerCase().includes(q)
    })
  }, [availableShips, shipSearch, shipAbilityFilter])

  const convertedFleet = useMemo(
    () => myFleet.map(ship => ({
      shipTemplateId: ship.shipTemplateId,
      cells: ship.positions?.map(pos => ({ r: pos.y, c: pos.x })) || [],
    })),
    [myFleet]
  )

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
  const startBlockedReason = !isHost
    ? ''
    : room?.status === 'in_game'
      ? 'Gra już trwa.'
      : uniquePlayers.length < 2
        ? 'Czekasz na dołączenie drugiego gracza.'
        : playersReady < 2
          ? `Do startu potrzeba 2 gotowych graczy (aktualnie: ${playersReady}/2).`
          : ''

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

  function handleNotReady() {
    if (!socket) return
    setError('')
    socket.emit('player_not_ready', { roomId })
  }

  function handleChangeShipLimit(newLimit) {
    if (!socket) return
    setError('')
    socket.emit('change_ship_limit', { roomId, shipLimit: newLimit })
  }

  return (
    <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'32px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:'20px', alignItems:'flex-start', flexWrap:'wrap', marginBottom:'20px' }}>
        <div>
          <h1 style={{ color:'#e2e8f0', marginBottom:'6px' }}>Ustawianie floty</h1>
          {room && (
            <p style={{ color:'#64748b', fontSize:'0.85rem' }}>
              Plansza: {boardSize}×{boardSize} · Limit statków: {shipLimit} · Tura: {room.settings?.turnTimeLimit}s · Tryb: {room?.isRanked ? 'Rankingowy' : 'Nierankingowy'}
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
              const isCurrentPlayer = playerId === user?._id?.toString()
              return (
                <div key={playerId || idx}>
                  <div style={playerRowStyle}>
                    <div>
                      <div style={{ color:'#e2e8f0', fontSize:'0.9rem', fontWeight:600 }}>
                        {player.userId?.username || player.userId?.email?.split('@')[0] || `Gracz ${idx + 1}`}
                        {isPlayerHost && <span style={hostBadgeStyle}>HOST</span>}
                        {isCurrentPlayer && <span style={meBadgeStyle}>TY</span>}
                      </div>
                    </div>
                    <span style={{ color: player.ready ? '#4ade80' : '#f59e0b', fontSize:'0.8rem', fontWeight:700 }}>
                      {player.ready ? 'GOTOWY' : 'CZEKA'}
                    </span>
                  </div>
                  {isCurrentPlayer && player.ready && (
                    <button
                      onClick={handleNotReady}
                      style={{
                        marginTop: '6px',
                        width: '100%',
                        background: 'rgba(239,68,68,0.12)',
                        color: '#f87171',
                        border: '1px solid rgba(239,68,68,0.25)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ← Wycofaj gotowość
                    </button>
                  )}
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
               {!canStartGame && startBlockedReason && (
                 <p style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '8px', marginBottom: 0 }}>
                   {startBlockedReason}
                 </p>
               )}

                <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                 <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>
                   Liczba statków:
                 </label>
                 <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                   <input
                     type="number"
                     min="1"
                     max="10"
                     value={shipLimitInput}
                     onChange={(e) => setShipLimitInput(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
                     style={{
                       flex: 1,
                       background: 'rgba(255,255,255,0.05)',
                       color: '#e2e8f0',
                       border: '1px solid rgba(255,255,255,0.15)',
                       borderRadius: '6px',
                       padding: '6px 8px',
                       fontSize: '0.85rem',
                     }}
                   />
                   <button
                     onClick={() => handleChangeShipLimit(shipLimitInput)}
                     disabled={shipLimitInput === room?.settings?.shipLimit}
                     style={{
                       background: shipLimitInput !== room?.settings?.shipLimit ? 'rgba(37,99,235,0.2)' : 'rgba(200,200,200,0.1)',
                       color: shipLimitInput !== room?.settings?.shipLimit ? '#60a5fa' : '#888',
                       border: shipLimitInput !== room?.settings?.shipLimit ? '1px solid rgba(37,99,235,0.4)' : '1px solid rgba(200,200,200,0.2)',
                       borderRadius: '6px',
                       padding: '6px 12px',
                       fontSize: '0.75rem',
                       fontWeight: 600,
                       cursor: shipLimitInput !== room?.settings?.shipLimit ? 'pointer' : 'default',
                     }}
                   >
                     Zmień
                   </button>
                 </div>
               </div>

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
                 {showMapPicker ? 'Ukryj wybór mapy' : ' Zmień mapę'}
               </button>
               {showMapPicker && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {availableBoards.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>Brak dostępnych map.</p>
                  ) : availableBoards.map(b => {
                    const bid = b._id || b.id
                    const isActive = (room?.settings?.boardTemplateId === bid || room?.settings?.boardTemplateId?._id === bid || room?.settings?.boardTemplateId?.toString() === bid)
                    const ownerLabel = b.source === 'own'
                      ? 'Twoja mapa'
                      : `Autor: ${b.owner?.username || b.owner?.email?.split('@')[0] || 'społeczność'}`
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
                        {' · '}{ownerLabel}
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
      ) : shipsLoading ? (
        <div style={infoBoxStyle}>Ładowanie statków…</div>
      ) : availableShips.length === 0 ? (
        <div style={infoBoxStyle}>
          {shipsLoadError || <>Brak dostępnych statków. <a href="/ships">Stwórz własne</a> albo włącz statki społeczności.</>}
          <div style={{ marginTop: '8px' }}>
            <button
              type='button'
              onClick={() => loadShipsCatalog().catch(() => setShipsLoadError('Nie udało się pobrać listy statków.'))}
              style={{ background:'rgba(37,99,235,0.15)', color:'#93c5fd', border:'1px solid rgba(37,99,235,0.3)', borderRadius:'7px', padding:'6px 10px', cursor:'pointer', fontSize:'0.78rem' }}
            >
              Odśwież listę statków
            </button>
          </div>
        </div>
      ) : isReady ? (
        <div style={infoBoxStyle}>
          ✓ Twoja flota została zatwierdzona. {canStartGame ? 'Możesz rozpocząć grę.' : 'Czekaj na drugiego gracza lub na start hosta.'}
        </div>
      ) : (
        <>
          <div style={{ marginBottom:'12px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'8px', alignItems:'center' }}>
            <input
              value={shipSearch}
              onChange={(e) => setShipSearch(e.target.value)}
              placeholder='Szukaj statku po nazwie/autorze...'
              style={{ background:'#0f1923', color:'#e2e8f0', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'8px', padding:'8px 10px', fontSize:'0.84rem' }}
            />
            <select
              value={shipAbilityFilter}
              onChange={(e) => setShipAbilityFilter(e.target.value)}
              style={{ background:'#0f1923', color:'#e2e8f0', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'8px', padding:'8px 10px', fontSize:'0.84rem' }}
            >
              <option value='all'>Wszystkie umiejętności</option>
              <option value='linear'>Liniowa</option>
              <option value='diagonal'>Skośna</option>
              <option value='random'>Losowa</option>
              <option value='target'>Precyzyjna</option>
              <option value='sonar'>Sonar</option>
              <option value='scout_rocket'>Rakieta zwiadowcza</option>
              <option value='holy_bomb'>Święta bomba</option>
              <option value='ship_shape'>Kształt statku</option>
            </select>
            <label style={{ display:'flex', alignItems:'center', gap:'6px', color:'#cbd5e1', fontSize:'0.82rem' }}>
              <input type='checkbox' checked={includeCommunityShips} onChange={(e) => setIncludeCommunityShips(e.target.checked)} />
              Statki społeczności
            </label>
          </div>

          {filteredShips.length === 0 ? (
            <div style={infoBoxStyle}>Brak statków spełniających aktualne filtry.</div>
          ) : (
            <FleetPlacer
              boardSize={boardSize}
              boardTiles={tiles}
              availableShips={filteredShips}
              shipLimit={shipLimit}
              initialFleet={convertedFleet}
              onFleetReady={fleet => {
                setError('')
                socket?.emit('place_fleet', { roomId, fleet })
              }}
              onFleetChange={setLocalPlacedShips}
              sidePanel={(
                <PlacedFleetSummary
                  placedShips={localPlacedShips}
                  availableShips={filteredShips}
                />
              )}
            />
          )}
        </>
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
