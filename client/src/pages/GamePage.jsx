import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useSocket from '../hooks/useSocket'
import useGame from '../hooks/useGame'
import useAuth from '../hooks/useAuth'
import GameBoard from '../components/game/GameBoard.jsx'
import FleetPanel from '../components/game/FleetPanel.jsx'
import AbilityPanel from '../components/game/AbilityPanel.jsx'
import TurnTimer from '../components/game/TurnTimer.jsx'
import { getAbilityInfo, formatCooldownTurns } from '../utils/abilityInfo.js'

const directionBtnStyle = {
  background: 'rgba(37,99,235,0.15)',
  color: '#60a5fa',
  border: '1px solid rgba(37,99,235,0.25)',
  borderRadius: '5px',
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: '0.78rem',
}

const confirmBtnStyle = {
  background: 'rgba(34,197,94,0.15)',
  color: '#4ade80',
  border: '1px solid rgba(34,197,94,0.25)',
  borderRadius: '5px',
  padding: '3px 10px',
  fontSize: '0.78rem',
}

export default function GamePage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const socket = useSocket()
  const { user } = useAuth()
  const {
    boards,
    myFleet,
    turn,
    turnStartedAt,
    turnTimeLimit,
    status,
    winnerId,
    boardSize,
    clearGame,
  } = useGame()

  const [error, setError] = useState('')
  const [sonarPositions, setSonarPositions] = useState([])
  const [targetingMode, setTargetingMode] = useState(null)
  const [selectedShipIndex, setSelectedShipIndex] = useState(0)
  const [linearDirection, setLinearDirection] = useState('horizontal')
  const [linearHoverStart, setLinearHoverStart] = useState(null)

  useEffect(() => {
    if (socket && gameId) socket.emit('reconnect_game', { gameId })
  }, [socket, gameId])

  useEffect(() => {
    if (!socket) return

    const onError = ({ message }) => setError(message)
    const onSonar = ({ positions }) => {
      setSonarPositions(positions || [])
      setTimeout(() => {
        setSonarPositions([])
      }, 3500)
    }

    socket.on('error', onError)
    socket.on('sonar_result', onSonar)
    return () => {
      socket.off('error', onError)
      socket.off('sonar_result', onSonar)
    }
  }, [socket])

  useEffect(() => {
    if (!myFleet?.length) return
    if (selectedShipIndex >= myFleet.length) setSelectedShipIndex(0)
  }, [myFleet, selectedShipIndex])

  const myId = user?._id
  const isMyTurn = turn === myId
  const myBoard = myId ? boards[myId] : null
  const enemyId = myId ? Object.keys(boards).find(id => id !== myId) : null
  const enemyBoard = enemyId ? boards[enemyId] : null
  const isGameOver = status === 'finished' || !!winnerId
  const iWon = winnerId === myId
  const selectedShip = myFleet?.[selectedShipIndex] || null
  const selectedAbility = getAbilityInfo(selectedShip?.abilityType, selectedShip?.positions?.length || 1)

  const pendingTargets = useMemo(() => targetingMode?.targets || [], [targetingMode])
  const linearPreview = useMemo(() => {
    if (!targetingMode || targetingMode.type !== 'linear' || !linearHoverStart || !selectedShip) {
      return { positions: [], invalid: false }
    }

    const length = selectedShip.positions?.length || 1
    const raw = Array.from({ length }, (_, step) => ({
      x: linearHoverStart.x + (linearDirection === 'horizontal' ? step : 0),
      y: linearHoverStart.y + (linearDirection === 'vertical' ? step : 0),
    }))

    const inBounds = raw.filter(({ x, y }) => x >= 0 && x < boardSize && y >= 0 && y < boardSize)
    return { positions: inBounds, invalid: inBounds.length !== raw.length }
  }, [targetingMode, linearHoverStart, selectedShip, linearDirection, boardSize])

  function handleEnemyClick(x, y) {
    if (targetingMode) {
      if (targetingMode.type === 'linear') {
        if (linearPreview.invalid) return
        socket?.emit('use_ability', {
          gameId,
          shipIndex: targetingMode.shipIndex,
          targets: [{ x, y }],
          orientation: linearDirection,
        })
        setTargetingMode(null)
        setLinearHoverStart(null)
        return
      }

      if (targetingMode.type === 'sonar') {
        socket?.emit('use_ability', {
          gameId,
          shipIndex: targetingMode.shipIndex,
          targets: [{ x, y }],
        })
        setTargetingMode(null)
        setLinearHoverStart(null)
        return
      }

      const alreadyChosen = targetingMode.targets.some(target => target.x === x && target.y === y)
      if (alreadyChosen) return
      if (targetingMode.targets.length >= targetingMode.maxTargets) return

      const newTargets = [...targetingMode.targets, { x, y }]
      setTargetingMode(prev => ({ ...prev, targets: newTargets }))
      return
    }

    if (!isMyTurn) return
    socket?.emit('make_move', { gameId, x, y })
  }

  function handleUseAbility(shipIndex) {
    const ship = myFleet?.[shipIndex]
    if (!ship) return

    if (ship.abilityType === 'linear') {
      setTargetingMode({ type: 'linear', shipIndex, maxTargets: 1, targets: [] })
      setLinearHoverStart(null)
      return
    }

    if (ship.abilityType === 'sonar') {
      setTargetingMode({ type: 'sonar', shipIndex, maxTargets: 1, targets: [] })
      setLinearHoverStart(null)
      return
    }

    if (ship.abilityType === 'target') {
      setTargetingMode({ type: 'target', shipIndex, maxTargets: ship.positions?.length || 1, targets: [] })
      setLinearHoverStart(null)
      return
    }

    socket?.emit('use_ability', { gameId, shipIndex })
  }

  function confirmTargetAbility() {
    if (!targetingMode || targetingMode.type !== 'target' || targetingMode.targets.length === 0) return
    socket?.emit('use_ability', { gameId, shipIndex: targetingMode.shipIndex, targets: targetingMode.targets })
    setTargetingMode(null)
    setLinearHoverStart(null)
  }

  if (!myBoard && !enemyBoard && !isGameOver) {
    return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', color:'#64748b', fontSize:'1.1rem' }}>Ładowanie gry…</div>
  }

  return (
    <div style={{ background:'#0f1923', minHeight:'100vh', padding:'16px' }}>
      {isGameOver && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
          <div style={{ background:'#1a2940', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px', padding:'40px', textAlign:'center', minWidth:'300px' }}>
            <div style={{ fontSize:'3.5rem', marginBottom:'12px' }}>{iWon ? '🏆' : '💀'}</div>
            <h2 style={{ color:'#e2e8f0', fontSize:'1.8rem', marginBottom:'8px' }}>{iWon ? 'Zwycięstwo!' : 'Porażka'}</h2>
            <p style={{ color:'#64748b', marginBottom:'28px' }}>{iWon ? 'Zatopiłeś wszystkie statki przeciwnika!' : 'Twoja flota została zniszczona.'}</p>
            <button onClick={() => { clearGame(); navigate('/') }} style={{ background:'#2563eb', color:'white', border:'none', borderRadius:'8px', padding:'12px 28px', fontWeight:'700', cursor:'pointer', fontSize:'1rem' }}>Powrót do lobby</button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', color:'#f87171', padding:'8px 14px', borderRadius:'8px', marginBottom:'12px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.85rem' }}>
          {error}
          <button onClick={() => setError('')} style={{ background:'none', border:'none', color:'#f87171', cursor:'pointer' }}>✕</button>
        </div>
      )}

      {targetingMode && (
        <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', color:'#fbbf24', padding:'8px 14px', borderRadius:'8px', marginBottom:'12px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.85rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
            <span>
              🎯 {selectedShip?.name || `Statek ${targetingMode.shipIndex + 1}`} — {targetingMode.type === 'linear'
                ? `kliknij początek salwy (${linearDirection === 'horizontal' ? 'poziomo' : 'pionowo'}, długość ${selectedShip?.positions?.length || 1})`
                : targetingMode.type === 'sonar'
                  ? 'kliknij pole, z którego ma pójść impuls sonaru'
                : `wybierz do ${targetingMode.maxTargets} pól (${targetingMode.targets.length}/${targetingMode.maxTargets})`}
            </span>
            {targetingMode.type === 'linear' && linearPreview.invalid && (
              <span style={{ color: '#f87171' }}>Linia wychodzi poza planszę</span>
            )}
            {targetingMode.type === 'linear' && (
              <div style={{ display:'flex', gap:'6px' }}>
                <button onClick={() => setLinearDirection('horizontal')} style={{ ...directionBtnStyle, opacity: linearDirection === 'horizontal' ? 1 : 0.6 }}>Poziomo</button>
                <button onClick={() => setLinearDirection('vertical')} style={{ ...directionBtnStyle, opacity: linearDirection === 'vertical' ? 1 : 0.6 }}>Pionowo</button>
              </div>
            )}
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            {targetingMode.type === 'target' && (
              <button onClick={confirmTargetAbility} disabled={targetingMode.targets.length === 0} style={{ ...confirmBtnStyle, opacity: targetingMode.targets.length > 0 ? 1 : 0.5, cursor: targetingMode.targets.length > 0 ? 'pointer' : 'not-allowed' }}>Zatwierdź</button>
            )}
            <button onClick={() => { setTargetingMode(null); setLinearHoverStart(null) }} style={{ background:'rgba(239,68,68,0.15)', color:'#f87171', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'5px', padding:'3px 10px', cursor:'pointer', fontSize:'0.78rem' }}>Anuluj</button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:'12px', alignItems:'center', marginBottom:'14px', background:'#1a2940', borderRadius:'10px', padding:'10px 16px', border:'1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ fontWeight:'700', fontSize:'1rem', color: isMyTurn ? '#22c55e' : '#f59e0b' }}>
          {isMyTurn ? '⚡ TWOJA TURA' : '⏳ Tura przeciwnika'}
        </span>
        <TurnTimer turnTimeLimit={turnTimeLimit || 60} turnStartedAt={turnStartedAt} />
      </div>

      <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', marginBottom:'16px' }}>
        <div style={{ flex:1, minWidth:'280px' }}>
          <h3 style={{ color:'#64748b', fontSize:'0.75rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>TWOJA PLANSZA</h3>
          {myBoard && <GameBoard tiles={myBoard} isOwnBoard={true} boardSize={boardSize} />}
        </div>
        <div style={{ flex:1, minWidth:'280px' }}>
          <h3 style={{ color:'#64748b', fontSize:'0.75rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>
            PLANSZA PRZECIWNIKA {targetingMode ? '— klikaj, aby wybierać cele' : isMyTurn ? '— kliknij, aby strzelić' : ''}
          </h3>
          {enemyBoard && (
            <GameBoard
              tiles={enemyBoard}
              isOwnBoard={false}
              onTileClick={handleEnemyClick}
              onTileHover={(x, y) => {
                if (targetingMode?.type === 'linear') setLinearHoverStart({ x, y })
              }}
              onTileLeave={() => {
                if (targetingMode?.type === 'linear') setLinearHoverStart(null)
              }}
              boardSize={boardSize}
              sonarPositions={sonarPositions}
              targetPositions={pendingTargets}
              previewPositions={targetingMode?.type === 'linear' ? linearPreview.positions : []}
              previewInvalid={targetingMode?.type === 'linear' ? linearPreview.invalid : false}
              isTargeting={!!targetingMode}
            />
          )}
        </div>
      </div>

      <div style={{ display:'flex', gap:'20px', flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:'260px', background:'#1a2940', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', padding:'14px' }}>
          <h3 style={{ color:'#64748b', fontSize:'0.72rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'10px' }}>TWOJA FLOTA</h3>
          <FleetPanel fleet={myFleet} selectedShipIndex={selectedShipIndex} onSelectShip={setSelectedShipIndex} />
        </div>

        {selectedShip && (
          <div style={{ flex:1, minWidth:'280px', background:'#1a2940', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', padding:'14px' }}>
            <div style={{ color:'#64748b', fontSize:'0.72rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'10px' }}>AKTYWNA UMIEJĘTNOŚĆ</div>
            <div style={{ color:'#e2e8f0', fontSize:'0.95rem', fontWeight:700, marginBottom:'4px' }}>{selectedShip.name || `Statek ${selectedShipIndex + 1}`}</div>
            <div style={{ color:'#94a3b8', fontSize:'0.8rem', marginBottom:'4px' }}>{selectedAbility.label}</div>
            <div style={{ color:'#64748b', fontSize:'0.76rem', marginBottom:'10px' }}>Bazowy cooldown: {formatCooldownTurns(selectedAbility.cooldown)}</div>
            <AbilityPanel
              fleet={myFleet}
              selectedShipIndex={selectedShipIndex}
              onUseAbility={handleUseAbility}
              isMyTurn={isMyTurn}
              isTargeting={!!targetingMode}
              onCancelTarget={() => setTargetingMode(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
