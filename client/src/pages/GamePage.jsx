import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useSocket from '../hooks/useSocket'
import useGame from '../hooks/useGame'
import useAuth from '../hooks/useAuth'
import GameBoard from '../components/game/GameBoard.jsx'
import FleetPanel from '../components/game/FleetPanel.jsx'
import AbilityPanel from '../components/game/AbilityPanel.jsx'
import TurnTimer from '../components/game/TurnTimer.jsx'

export default function GamePage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const socket = useSocket()
  const { user } = useAuth()
  const { boards, myFleet, turn, turnStartedAt, status, winnerId, boardSize, players, clearGame } = useGame()
  const [error, setError] = useState('')
  const [sonarPositions, setSonarPositions] = useState([])
  const [targetingMode, setTargetingMode] = useState(null)

  useEffect(() => {
    if (socket && gameId) socket.emit('reconnect_game', { gameId })
  }, [socket, gameId])

  useEffect(() => {
    if (!socket) return
    const onError = ({ message }) => setError(message)
    const onSonar = ({ positions }) => {
      setSonarPositions(positions || [])
      setTimeout(() => setSonarPositions([]), 3000)
    }
    socket.on('error', onError)
    socket.on('sonar_result', onSonar)
    return () => { socket.off('error', onError); socket.off('sonar_result', onSonar) }
  }, [socket])

  const myId = user?._id
  const isMyTurn = turn === myId
  const myBoard = myId ? boards[myId] : null
  const enemyId = myId ? Object.keys(boards).find(id => id !== myId) : null
  const enemyBoard = enemyId ? boards[enemyId] : null
  const isGameOver = status === 'finished' || !!winnerId
  const iWon = winnerId === myId

  function handleEnemyClick(x, y) {
    if (targetingMode) {
      const newTargets = [...targetingMode.targets, { x, y }]
      if (newTargets.length >= targetingMode.maxTargets) {
        socket?.emit('use_ability', { gameId, shipIndex: targetingMode.shipIndex, targets: newTargets })
        setTargetingMode(null)
      } else {
        setTargetingMode(prev => ({ ...prev, targets: newTargets }))
      }
      return
    }
    if (!isMyTurn) return
    socket?.emit('make_move', { gameId, x, y })
  }

  function handleUseAbility(shipIndex) {
    const ship = myFleet?.[shipIndex]
    if (!ship) return
    if (ship.abilityType === 'target') setTargetingMode({ shipIndex, maxTargets: 3, targets: [] })
    else if (ship.abilityType === 'sonar') setTargetingMode({ shipIndex, maxTargets: 1, targets: [] })
    else socket?.emit('use_ability', { gameId, shipIndex })
  }

  if (!myBoard && !enemyBoard && !isGameOver) {
    return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', color:'#64748b', fontSize:'1.1rem' }}>Loading game…</div>
  }

  return (
    <div style={{ background:'#0f1923', minHeight:'100vh', padding:'16px' }}>
      {isGameOver && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
          <div style={{ background:'#1a2940', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px', padding:'40px', textAlign:'center', minWidth:'300px' }}>
            <div style={{ fontSize:'3.5rem', marginBottom:'12px' }}>{iWon ? '🏆' : '💀'}</div>
            <h2 style={{ color:'#e2e8f0', fontSize:'1.8rem', marginBottom:'8px' }}>{iWon ? 'Victory!' : 'Defeat'}</h2>
            <p style={{ color:'#64748b', marginBottom:'28px' }}>{iWon ? 'You sunk all enemy ships!' : 'Your fleet was destroyed.'}</p>
            <button onClick={() => { clearGame(); navigate('/') }} style={{ background:'#2563eb', color:'white', border:'none', borderRadius:'8px', padding:'12px 28px', fontWeight:'700', cursor:'pointer', fontSize:'1rem' }}>Return to Lobby</button>
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
          <span>🎯 Select {targetingMode.maxTargets - targetingMode.targets.length} more target(s) on the enemy board</span>
          <button onClick={() => setTargetingMode(null)} style={{ background:'rgba(239,68,68,0.15)', color:'#f87171', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'5px', padding:'3px 10px', cursor:'pointer', fontSize:'0.78rem' }}>Cancel</button>
        </div>
      )}

      <div style={{ display:'flex', gap:'12px', alignItems:'center', marginBottom:'14px', background:'#1a2940', borderRadius:'10px', padding:'10px 16px', border:'1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ fontWeight:'700', fontSize:'1rem', color: isMyTurn ? '#22c55e' : '#f59e0b' }}>
          {isMyTurn ? '⚡ YOUR TURN' : "⏳ Opponent's Turn"}
        </span>
        <TurnTimer turnTimeLimit={60} turnStartedAt={turnStartedAt} />
      </div>

      <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', marginBottom:'16px' }}>
        <div style={{ flex:1, minWidth:'280px' }}>
          <h3 style={{ color:'#64748b', fontSize:'0.75rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>YOUR BOARD</h3>
          {myBoard && <GameBoard tiles={myBoard} isOwnBoard={true} boardSize={boardSize} />}
        </div>
        <div style={{ flex:1, minWidth:'280px' }}>
          <h3 style={{ color:'#64748b', fontSize:'0.75rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>
            ENEMY BOARD {targetingMode ? '— click to select target' : isMyTurn ? '— click to shoot' : ''}
          </h3>
          {enemyBoard && <GameBoard tiles={enemyBoard} isOwnBoard={false} onTileClick={handleEnemyClick} boardSize={boardSize} sonarPositions={sonarPositions} />}
        </div>
      </div>

      <div style={{ display:'flex', gap:'20px', flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:'220px', background:'#1a2940', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', padding:'14px' }}>
          <h3 style={{ color:'#64748b', fontSize:'0.72rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'10px' }}>YOUR FLEET</h3>
          <FleetPanel fleet={myFleet} />
        </div>
        {myFleet && myFleet.some(s => s.abilityType && s.abilityType !== 'none') && (
          <div style={{ flex:1, minWidth:'220px', background:'#1a2940', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', padding:'14px' }}>
            <AbilityPanel
              fleet={myFleet}
              onUseAbility={handleUseAbility}
              isMyTurn={isMyTurn}
              gameId={gameId}
              isTargeting={!!targetingMode}
              onCancelTarget={() => setTargetingMode(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
