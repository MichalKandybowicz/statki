import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useSocket from '../hooks/useSocket'
import useGame from '../hooks/useGame'
import useAuth from '../hooks/useAuth'
import GameBoard from '../components/game/GameBoard.jsx'
import FleetPanel from '../components/game/FleetPanel.jsx'
import AbilityPanel from '../components/game/AbilityPanel.jsx'
import TurnTimer from '../components/game/TurnTimer.jsx'
import { getAbilityInfo, formatCooldownTurns } from '../utils/abilityInfo.js'

const SOUND_SETTINGS_KEY = 'statki:sound-settings:v2'
const BATTLE_LAYOUT_KEY = 'statki:battle-layout:v1'
const ABILITY_REVEAL_STEP_MS = 1000
const DEFAULT_SOUND_SETTINGS = {
  masterVolume: 0.8,
  turnEnd: { enabled: true, volume: 0.9, src: '/sounds/turn-end.mp3' },
  hit: { enabled: true, volume: 1, src: '/sounds/hit.mp3' },
  miss: { enabled: true, volume: 0.85, src: '/sounds/miss.mp3' },
  sonarHit: { enabled: true, volume: 0.9, src: '/sounds/sonar-true.mp3', maxDuration: 1.5 },
  sonarMiss: { enabled: true, volume: 0.8, src: '/sounds/sonar-false.mp3', maxDuration: 1.5 },
}

const DEFAULT_BATTLE_LAYOUT = {
  mode: 'bottom-horizontal',
  boardZoom: 1,
}

export default function GamePage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const socket = useSocket()
  const { user } = useAuth()
  const myId = user?._id
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
   const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false)
   const [enemySonarPositions, setEnemySonarPositions] = useState([])
   const [ownSonarPositions, setOwnSonarPositions] = useState([])
   const [targetingMode, setTargetingMode] = useState(null)
   const [selectedShipIndex, setSelectedShipIndex] = useState(0)
   const [linearDirection, setLinearDirection] = useState('horizontal')
   const [linearHoverStart, setLinearHoverStart] = useState(null)
   const [battleLog, setBattleLog] = useState([])
   const [showSoundMenu, setShowSoundMenu] = useState(false)
   const [soundSettings, setSoundSettings] = useState(DEFAULT_SOUND_SETTINGS)
   const [battleLayout, setBattleLayout] = useState(DEFAULT_BATTLE_LAYOUT)
   const [watchingPlayerId, setWatchingPlayerId] = useState(null)
   const [swapBoards, setSwapBoards] = useState(false)
  const previousTurnRef = useRef(null)
  const pendingEffectTimeoutsRef = useRef([])
  const pendingEffectsUntilRef = useRef(0)

  const clearPendingEffects = useCallback(() => {
    pendingEffectTimeoutsRef.current.forEach(item => clearTimeout(item.id))
    pendingEffectTimeoutsRef.current = []
    pendingEffectsUntilRef.current = 0
  }, [])

  const queueEffect = useCallback((fn, delayMs) => {
    const runAt = Date.now() + Math.max(0, delayMs)
    pendingEffectsUntilRef.current = Math.max(pendingEffectsUntilRef.current, runAt)

    const tid = setTimeout(() => {
      pendingEffectTimeoutsRef.current = pendingEffectTimeoutsRef.current.filter(item => item.id !== tid)
      fn()
    }, delayMs)

    pendingEffectTimeoutsRef.current.push({ id: tid, runAt })
  }, [])

  const appendLogEntry = useCallback((message, type = 'info') => {
    setBattleLog(prev => {
      const next = [...prev, { id: `${Date.now()}-${Math.random()}`, message, type, ts: Date.now() }]
      return next.slice(-80)
    })
  }, [])

  const mergeUniquePositions = useCallback((prev, next) => {
    const map = new Map(prev.map(p => [`${p.x}:${p.y}`, p]))
    for (const pos of next || []) {
      if (typeof pos?.x !== 'number' || typeof pos?.y !== 'number') continue
      map.set(`${pos.x}:${pos.y}`, { x: pos.x, y: pos.y })
    }
    return Array.from(map.values())
  }, [])

  const dropResolvedSonar = useCallback((positions, board) => {
    if (!Array.isArray(positions) || !board) return positions || []
    return positions.filter(({ x, y }) => {
      const tile = board?.[y]?.[x]
      return tile !== 'hit' && tile !== 'miss' && tile !== 'sunk'
    })
  }, [])

  const toCellLabel = useCallback((x, y) => {
    if (typeof x !== 'number' || typeof y !== 'number') return '??'
    return `${String.fromCharCode(65 + y)}${x + 1}`
  }, [])

   useEffect(() => {
     try {
       const raw = localStorage.getItem(SOUND_SETTINGS_KEY)
       if (!raw) return
       const parsed = JSON.parse(raw)
       setSoundSettings({
         masterVolume: Number(parsed.masterVolume ?? DEFAULT_SOUND_SETTINGS.masterVolume),
         turnEnd: { ...DEFAULT_SOUND_SETTINGS.turnEnd, ...(parsed.turnEnd || {}) },
         hit: { ...DEFAULT_SOUND_SETTINGS.hit, ...(parsed.hit || {}) },
         miss: { ...DEFAULT_SOUND_SETTINGS.miss, ...(parsed.miss || {}) },
         // Wymuszenie dedykowanych plikow sonaru zapobiega dziedziczeniu starego src hit/miss.
         sonarHit: {
           ...DEFAULT_SOUND_SETTINGS.sonarHit,
           ...(parsed.sonarHit || {}),
           src: DEFAULT_SOUND_SETTINGS.sonarHit.src,
           maxDuration: DEFAULT_SOUND_SETTINGS.sonarHit.maxDuration,
         },
         sonarMiss: {
           ...DEFAULT_SOUND_SETTINGS.sonarMiss,
           ...(parsed.sonarMiss || {}),
           src: DEFAULT_SOUND_SETTINGS.sonarMiss.src,
           maxDuration: DEFAULT_SOUND_SETTINGS.sonarMiss.maxDuration,
         },
       })
     } catch {}
   }, [])

  useEffect(() => {
    localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(soundSettings))
  }, [soundSettings])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BATTLE_LAYOUT_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      setBattleLayout({
        mode: ['left-stacked', 'left-side-by-side', 'bottom-horizontal'].includes(parsed?.mode)
          ? parsed.mode
          : 'bottom-horizontal',
        boardZoom: Number.isFinite(Number(parsed?.boardZoom))
          ? Math.min(1.8, Math.max(0.6, Number(parsed.boardZoom)))
          : 1,
      })
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem(BATTLE_LAYOUT_KEY, JSON.stringify(battleLayout))
  }, [battleLayout])

  const updateSoundSettings = useCallback((next) => {
    setSoundSettings(prev => ({ ...prev, ...next }))
  }, [])

  const updateSingleSound = useCallback((soundKey, patch) => {
    setSoundSettings(prev => ({
      ...prev,
      [soundKey]: {
        ...prev[soundKey],
        ...patch,
      },
    }))
  }, [])

   const playConfiguredSound = useCallback((soundKey, fallbackKind) => {
     try {
       const conf = soundSettings[soundKey]
       if (!conf?.enabled) return
       const baseVol = Math.max(0, Math.min(1, soundSettings.masterVolume || 0))
       const localVol = Math.max(0, Math.min(1, conf.volume || 0))
       const finalVol = Math.max(0, Math.min(1, baseVol * localVol))
       if (finalVol <= 0) return

       const audio = new Audio(conf.src)
       audio.volume = finalVol

       // Obsługuj maxDuration (w sekundach)
       if (conf.maxDuration && conf.maxDuration > 0) {
         audio.addEventListener('canplay', () => {
           if (audio.duration > conf.maxDuration) {
             setTimeout(() => audio.pause(), conf.maxDuration * 1000)
           }
         }, { once: true })
       }

       audio.play().catch(() => {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return
        const ctx = new Ctx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = fallbackKind === 'turn' ? 'triangle' : fallbackKind === 'hit' ? 'square' : 'sine'
        if (fallbackKind === 'turn') {
          osc.frequency.setValueAtTime(760, ctx.currentTime)
          osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.12)
        } else if (fallbackKind === 'hit') {
          osc.frequency.setValueAtTime(540, ctx.currentTime)
          osc.frequency.exponentialRampToValueAtTime(860, ctx.currentTime + 0.1)
        } else {
          osc.frequency.setValueAtTime(420, ctx.currentTime)
          osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.11)
        }
        gain.gain.setValueAtTime(0.0001, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(Math.max(0.02, finalVol * 0.08), ctx.currentTime + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.15)
        setTimeout(() => ctx.close(), 250)
      })
    } catch {}
  }, [soundSettings])

   const playTurnEndSound = useCallback(() => {
     playConfiguredSound('turnEnd', 'turn')
   }, [playConfiguredSound])

   const playShotResultSound = useCallback((kind) => {
     playConfiguredSound(kind === 'hit' ? 'hit' : 'miss', kind)
   }, [playConfiguredSound])

   const playSonarSound = useCallback((soundKey) => {
     playConfiguredSound(soundKey, 'sonar')
   }, [playConfiguredSound])

  useEffect(() => {
    if (socket && gameId) socket.emit('reconnect_game', { gameId })
  }, [socket, gameId])

  useEffect(() => {
    if (!socket) return

    const onError = ({ message }) => setError(message)
    const onSonar = ({ positions }) => {
      setEnemySonarPositions(prev => mergeUniquePositions(prev, positions || []))
    }

    const onMoveResult = ({ playerId, x, y, hit, sunk }) => {
      const actor = playerId === myId ? 'Ty' : 'Przeciwnik'
      const cell = toCellLabel(x, y)
      const outcome = sunk ? 'trafienie krytyczne (zatopienie)' : hit ? 'trafienie' : 'pudlo'
      appendLogEntry(`${actor}: strzal w ${cell} -> ${outcome}`, hit ? 'hit' : 'miss')
      playShotResultSound(hit || sunk ? 'hit' : 'miss')
    }

    const onAbilityResult = ({ playerId, abilityType, results, origin, foundCount, positions }) => {
      const actor = playerId === myId ? 'Ty' : 'Przeciwnik'

      if (abilityType === 'sonar') {
         const labels = (positions || []).map(pos => toCellLabel(pos.x, pos.y))
         const labelText = labels.length > 0 ? ` [${labels.join(', ')}]` : ''
         if (playerId === myId) {
           const originLabel = origin ? toCellLabel(origin.x, origin.y) : '??'
           appendLogEntry(`${actor}: sonar z ${originLabel} -> wykryto ${foundCount || 0} pol${labelText}`, 'sonar')
           setEnemySonarPositions(prev => mergeUniquePositions(prev, positions || []))
         } else {
           appendLogEntry(`${actor}: sonar wykryl ${foundCount || 0} pol${labelText}`, 'sonar')
           setOwnSonarPositions(prev => mergeUniquePositions(prev, positions || []))
         }
         // Graj dźwięk sonaru
         playSonarSound(foundCount > 0 ? 'sonarHit' : 'sonarMiss')
         return
       }

      const shots = Array.isArray(results) ? results.length : 0
      const hits = Array.isArray(results) ? results.filter(r => r.hit).length : 0
      const sunkAny = Array.isArray(results) ? results.some(r => r.sunk) : false

      if (shots <= 1) {
        const single = Array.isArray(results) ? results[0] : null
        const cellText = single ? ` (${toCellLabel(single.x, single.y)})` : ''
        appendLogEntry(
          `${actor}: umiejetnosc ${abilityType || 'specjalna'}${cellText} -> strzaly ${shots}, trafienia ${hits}${sunkAny ? ', zatopienie' : ''}`,
          hits > 0 ? 'hit' : 'info'
        )
      } else {
        appendLogEntry(`${actor}: umiejetnosc ${abilityType || 'specjalna'} -> salwa ${shots} strzalow`, 'info')
        results.forEach((shot, idx) => {
          queueEffect(() => {
            const cell = toCellLabel(shot.x, shot.y)
            const shotOutcome = shot.sunk ? 'zatopienie' : shot.hit ? 'trafienie' : 'pudlo'
            appendLogEntry(`${actor}: pocisk ${idx + 1}/${shots} w ${cell} -> ${shotOutcome}`, shot.hit ? 'hit' : 'miss')
          }, idx * ABILITY_REVEAL_STEP_MS)
        })
      }

      if (shots > 0) {
        if (shots === 1) {
          playShotResultSound(hits > 0 || sunkAny ? 'hit' : 'miss')
        } else {
          results.forEach((shot, idx) => {
            queueEffect(() => {
              playShotResultSound(shot.hit || shot.sunk ? 'hit' : 'miss')
            }, idx * ABILITY_REVEAL_STEP_MS)
          })
        }
      }
    }

    const onTurnUpdate = ({ turn: turnPlayerId }) => {
      const turnText = turnPlayerId === myId ? 'Twoja tura' : 'Tura przeciwnika'
      appendLogEntry(`Zmiana tury: ${turnText}`, 'turn')
    }

  const onGameOver = ({ winnerId: winner, surrenderedBy }) => {
      const surrenderNote = surrenderedBy && surrenderedBy !== myId ? ' (przeciwnik sie poddal)' : surrenderedBy === myId ? ' (poddales sie)' : ''
      appendLogEntry((winner === myId ? 'Koniec gry: wygrywasz' : 'Koniec gry: przegrywasz') + surrenderNote, 'over')
    }

    socket.on('error', onError)
    socket.on('sonar_result', onSonar)
    socket.on('move_result', onMoveResult)
    socket.on('ability_result', onAbilityResult)
    socket.on('turn_update', onTurnUpdate)
    socket.on('game_over', onGameOver)
     return () => {
       socket.off('error', onError)
       socket.off('sonar_result', onSonar)
       socket.off('move_result', onMoveResult)
       socket.off('ability_result', onAbilityResult)
       socket.off('turn_update', onTurnUpdate)
       socket.off('game_over', onGameOver)
     }
   }, [socket, myId, appendLogEntry, toCellLabel, playShotResultSound, playSonarSound, queueEffect, mergeUniquePositions])

  useEffect(() => {
    if (!myId) return
    const previousTurn = previousTurnRef.current
    if (previousTurn && previousTurn !== turn && turn === myId) {
      const waitMs = Math.max(0, pendingEffectsUntilRef.current - Date.now())
      if (waitMs > 0) {
        queueEffect(() => {
          playTurnEndSound()
        }, waitMs + 80)
      } else {
        playTurnEndSound()
      }
    }
    previousTurnRef.current = turn
  }, [turn, myId, playTurnEndSound, queueEffect])

   useEffect(() => {
     setBattleLog([])
     setEnemySonarPositions([])
     setOwnSonarPositions([])
     previousTurnRef.current = null
     clearPendingEffects()
     setWatchingPlayerId(null)
     setSwapBoards(false)
   }, [gameId, clearPendingEffects])

   // Inicjalizuj obserwowanego gracza na siebie
   useEffect(() => {
     if (!watchingPlayerId && myId) {
       setWatchingPlayerId(myId)
     }
   }, [watchingPlayerId, myId])

   const isMyTurn = turn === myId
   const myBoard = myId ? boards[myId] : null
   const enemyId = myId ? Object.keys(boards).find(id => id !== myId) : null
   const enemyBoard = enemyId ? boards[enemyId] : null
   const isGameOver = status === 'finished' || !!winnerId
   const iWon = winnerId === myId
   const selectedShip = myFleet?.[selectedShipIndex] || null
   const selectedAbility = getAbilityInfo(selectedShip?.abilityType, selectedShip?.positions?.length || 1)
   
   // Plansze wszystkich graczy
   const allPlayerIds = myId ? Object.keys(boards) : []
   const watchedBoard = watchingPlayerId ? boards[watchingPlayerId] : null
   const isWatchingOwnBoard = watchingPlayerId === myId

  useEffect(() => {
    setEnemySonarPositions(prev => dropResolvedSonar(prev, enemyBoard))
  }, [enemyBoard, dropResolvedSonar])

  useEffect(() => {
    setOwnSonarPositions(prev => dropResolvedSonar(prev, myBoard))
  }, [myBoard, dropResolvedSonar])

  useEffect(() => {
    return () => clearPendingEffects()
  }, [clearPendingEffects])

  useEffect(() => {
    if (!myFleet?.length) return
    if (selectedShipIndex >= myFleet.length) setSelectedShipIndex(0)
  }, [myFleet, selectedShipIndex])


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

  const boardZoom = Number(battleLayout.boardZoom || 1)
  const enemyBoardMaxPx = useMemo(() => {
    const base = battleLayout.mode === 'left-stacked' ? 560 : 420
    return Math.round(base * boardZoom)
  }, [battleLayout.mode, boardZoom])
  const ownBoardMaxPx = useMemo(() => {
    const base = battleLayout.mode === 'left-stacked' ? 560 : 420
    return Math.round(base * boardZoom)
  }, [battleLayout.mode, boardZoom])
  const isBottomHorizontalLayout = battleLayout.mode === 'bottom-horizontal'

  const fleetAbilityPanel = (
    <div style={{ background:'#1a2940', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', padding:'14px', height:'100%', boxSizing:'border-box' }}>
      <h3 style={{ color:'#64748b', fontSize:'0.72rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'10px' }}>FLOTA I UMIEJĘTNOŚCI</h3>
      <div style={{ display:'grid', gridTemplateColumns: isBottomHorizontalLayout ? 'minmax(0, 1.6fr) minmax(260px, 1fr)' : '1fr', gap:'14px', alignItems:'start' }}>
        <FleetPanel fleet={myFleet} selectedShipIndex={selectedShipIndex} onSelectShip={setSelectedShipIndex} columns={isBottomHorizontalLayout ? 3 : 1} />

        {selectedShip && (
          <div style={{ marginTop:isBottomHorizontalLayout ? 0 : '12px', paddingTop:isBottomHorizontalLayout ? 0 : '12px', borderTop:isBottomHorizontalLayout ? 'none' : '1px solid rgba(255,255,255,0.08)', borderLeft:isBottomHorizontalLayout ? '1px solid rgba(255,255,255,0.08)' : 'none', paddingLeft:isBottomHorizontalLayout ? '14px' : 0 }}>
          <div style={{ color:'#e2e8f0', fontSize:'0.95rem', fontWeight:700, marginBottom:'4px' }}>{selectedShip.name || `Statek ${selectedShipIndex + 1}`}</div>
          <div style={{ color:'#94a3b8', fontSize:'0.8rem', marginBottom:'4px' }}>{selectedAbility.label}</div>
          <div style={{ color:'#64748b', fontSize:'0.76rem', marginBottom:'10px' }}>Bazowy cooldown: {formatCooldownTurns(selectedAbility.cooldown)}</div>
          <AbilityPanel
            fleet={myFleet}
            selectedShipIndex={selectedShipIndex}
            onUseAbility={handleUseAbility}
            isMyTurn={isMyTurn}
            isTargeting={!!targetingMode}
            onCancelTarget={() => { setTargetingMode(null); setLinearHoverStart(null) }}
            targetingMode={targetingMode}
            linearDirection={linearDirection}
            onSetLinearDirection={setLinearDirection}
            onConfirmTarget={confirmTargetAbility}
            linearPreviewInvalid={targetingMode?.type === 'linear' ? linearPreview.invalid : false}
          />
          </div>
        )}
      </div>
    </div>
  )

  const enemyBoardPanel = (
    <div>
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
          sonarPositions={enemySonarPositions}
          targetPositions={pendingTargets}
          previewPositions={targetingMode?.type === 'linear' ? linearPreview.positions : []}
          previewInvalid={targetingMode?.type === 'linear' ? linearPreview.invalid : false}
          isTargeting={!!targetingMode}
          maxBoardPx={enemyBoardMaxPx}
        />
      )}
    </div>
  )

   const myBoardPanel = (
     <div>
       <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px', gap:'8px' }}>
         <h3 style={{ color:'#64748b', fontSize:'0.75rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', margin:0 }}>
           {isWatchingOwnBoard ? 'TWOJA PLANSZA' : 'OBSERWACJA'}
         </h3>
         {allPlayerIds.length > 1 && (
           <select
             value={watchingPlayerId || ''}
             onChange={e => setWatchingPlayerId(e.target.value)}
             style={{
               background:'rgba(37,99,235,0.15)',
               color:'#60a5fa',
               border:'1px solid rgba(37,99,235,0.3)',
               borderRadius:'5px',
               padding:'4px 8px',
               fontSize:'0.75rem',
               cursor:'pointer',
               fontWeight:'600',
             }}
           >
           </select>
         )}
       </div>
       {watchedBoard && <GameBoard tiles={watchedBoard} isOwnBoard={isWatchingOwnBoard} boardSize={boardSize} sonarPositions={isWatchingOwnBoard ? ownSonarPositions : []} maxBoardPx={ownBoardMaxPx} />}
     </div>
   )

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

      <div style={{ display:'flex', gap:'12px', alignItems:'center', marginBottom:'14px', background:'#1a2940', borderRadius:'10px', padding:'10px 16px', border:'1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ fontWeight:'700', fontSize:'1rem', color: isMyTurn ? '#22c55e' : '#f59e0b' }}>
          {isMyTurn ? '⚡ TWOJA TURA' : '⏳ Tura przeciwnika'}
        </span>
        <TurnTimer turnTimeLimit={turnTimeLimit || 60} turnStartedAt={turnStartedAt} />
        <div style={{ marginLeft: 'auto', display:'flex', gap:'8px', position: 'relative', alignItems:'center' }}>
          <button
            onClick={() => setBattleLayout(prev => ({ ...prev, mode: 'left-stacked' }))}
            style={{ background:battleLayout.mode === 'left-stacked' ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.10)', color:'#6ee7b7', border:'1px solid rgba(16,185,129,0.35)', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.78rem' }}
          >
            Układ 1
          </button>
          <button
            onClick={() => setBattleLayout(prev => ({ ...prev, mode: 'left-side-by-side' }))}
            style={{ background:battleLayout.mode === 'left-side-by-side' ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.12)', color:'#93c5fd', border:'1px solid rgba(37,99,235,0.28)', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.78rem' }}
          >
            Układ 2
          </button>
           <button
             onClick={() => setBattleLayout(prev => ({ ...prev, mode: 'bottom-horizontal' }))}
             style={{ background:battleLayout.mode === 'bottom-horizontal' ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.12)', color:'#a5b4fc', border:'1px solid rgba(99,102,241,0.28)', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.78rem' }}
           >
             Układ 3
           </button>
           <div style={{ width:'1px', height:'24px', background:'rgba(255,255,255,0.1)' }} />
           <button
             onClick={() => setSwapBoards(prev => !prev)}
             style={{ background:swapBoards ? 'rgba(168,85,247,0.18)' : 'rgba(168,85,247,0.10)', color:'#d8b4fe', border:'1px solid rgba(168,85,247,0.35)', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.78rem' }}
           >
             🔄 Swap
           </button>
          <button
            onClick={() => setBattleLayout(prev => ({ ...prev, boardZoom: Math.max(0.6, Math.round((prev.boardZoom - 0.1) * 10) / 10) }))}
            style={{ background:'rgba(255,255,255,0.06)', color:'#cbd5e1', border:'1px solid rgba(255,255,255,0.14)', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.78rem' }}
          >
            −
          </button>
          <span style={{ color:'#94a3b8', fontSize:'0.78rem', minWidth:'52px', textAlign:'center' }}>{Math.round(boardZoom * 100)}%</span>
          <button
            onClick={() => setBattleLayout(prev => ({ ...prev, boardZoom: Math.min(1.8, Math.round((prev.boardZoom + 0.1) * 10) / 10) }))}
            style={{ background:'rgba(255,255,255,0.06)', color:'#cbd5e1', border:'1px solid rgba(255,255,255,0.14)', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.78rem' }}
          >
            +
          </button>
          {!showSurrenderConfirm ? (
            <button
              onClick={() => setShowSurrenderConfirm(true)}
              style={{ background:'rgba(239,68,68,0.12)', color:'#fca5a5', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.78rem' }}
            >
              Poddaj się
            </button>
          ) : (
            <div style={{ display:'flex', gap:'6px', alignItems:'center', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', padding:'6px 10px' }}>
              <span style={{ color:'#fca5a5', fontSize:'0.78rem' }}>Na pewno?</span>
              <button
                onClick={() => { socket?.emit('surrender', { gameId }); setShowSurrenderConfirm(false) }}
                style={{ background:'rgba(239,68,68,0.7)', color:'white', border:'none', borderRadius:'5px', padding:'3px 10px', cursor:'pointer', fontSize:'0.76rem', fontWeight:700 }}
              >
                Tak
              </button>
              <button
                onClick={() => setShowSurrenderConfirm(false)}
                style={{ background:'rgba(255,255,255,0.07)', color:'#94a3b8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'5px', padding:'3px 8px', cursor:'pointer', fontSize:'0.76rem' }}
              >
                Nie
              </button>
            </div>
          )}

          <button
            onClick={() => setShowSoundMenu(prev => !prev)}
            style={{ background:'rgba(255,255,255,0.06)', color:'#cbd5e1', border:'1px solid rgba(255,255,255,0.14)', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'0.78rem' }}
          >
            Dzwieki
          </button>
          {showSoundMenu && (
            <div style={{ position:'absolute', right:0, top:'40px', minWidth:'300px', zIndex:50, background:'#0f1923', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'10px', padding:'12px', boxShadow:'0 10px 30px rgba(0,0,0,0.35)' }}>
              <div style={{ color:'#94a3b8', fontSize:'0.72rem', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.06em' }}>Ustawienia audio</div>
              <div style={{ marginBottom:'10px' }}>
                <label style={{ color:'#cbd5e1', fontSize:'0.78rem', display:'block', marginBottom:'4px' }}>Glosnosc globalna: {Math.round((soundSettings.masterVolume || 0) * 100)}%</label>
                <input
                  type='range'
                  min='0'
                  max='1'
                  step='0.05'
                  value={soundSettings.masterVolume}
                  onChange={e => updateSoundSettings({ masterVolume: Number(e.target.value) })}
                  style={{ width:'100%', accentColor:'#2563eb' }}
                />
              </div>

               {[
                 { key: 'turnEnd', label: 'Koniec tury' },
                 { key: 'hit', label: 'Trafienie' },
                 { key: 'miss', label: 'Pudlo' },
                 { key: 'sonarHit', label: 'Sonar (coś wykrył)' },
                 { key: 'sonarMiss', label: 'Sonar (nic nie wykrył)' },
               ].map(item => (
                <div key={item.key} style={{ marginBottom:'10px', paddingBottom:'8px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', color:'#cbd5e1', fontSize:'0.78rem', marginBottom:'4px' }}>
                    <span>{item.label}</span>
                    <input
                      type='checkbox'
                      checked={!!soundSettings[item.key]?.enabled}
                      onChange={e => updateSingleSound(item.key, { enabled: e.target.checked })}
                    />
                  </label>
                  <input
                    type='range'
                    min='0'
                    max='1'
                    step='0.05'
                    value={soundSettings[item.key]?.volume || 0}
                    onChange={e => updateSingleSound(item.key, { volume: Number(e.target.value) })}
                    style={{ width:'100%', accentColor:'#2563eb' }}
                  />
                </div>
              ))}

              <div style={{ display:'flex', gap:'8px' }}>
                <button
                  onClick={() => setSoundSettings({
                    ...soundSettings,
                    turnEnd: { ...soundSettings.turnEnd, enabled: true },
                    hit: { ...soundSettings.hit, enabled: false },
                    miss: { ...soundSettings.miss, enabled: false },
                  })}
                  style={{ flex:1, background:'rgba(245,158,11,0.12)', color:'#fbbf24', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'6px', padding:'6px 8px', cursor:'pointer', fontSize:'0.74rem' }}
                >
                  Tylko koniec tury
                </button>
                <button
                  onClick={() => setSoundSettings(DEFAULT_SOUND_SETTINGS)}
                  style={{ flex:1, background:'rgba(37,99,235,0.15)', color:'#60a5fa', border:'1px solid rgba(37,99,235,0.3)', borderRadius:'6px', padding:'6px 8px', cursor:'pointer', fontSize:'0.74rem' }}
                >
                  Reset
                </button>
              </div>
            </div>
          )}
       </div>
       </div>

       {/* Logika swapowania planszy */}
       {swapBoards ? (
         <>
           {battleLayout.mode === 'left-stacked' && (
             <div style={{ display:'grid', gridTemplateColumns:'minmax(280px, 360px) minmax(0, 1fr)', gap:'16px', alignItems:'start' }}>
               <div style={{ display:'flex', flexDirection:'column', gap:'16px', position:'sticky', top:'76px' }}>
                 {fleetAbilityPanel}
               </div>
               <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                 {myBoardPanel}
                 {enemyBoardPanel}
               </div>
             </div>
           )}

           {battleLayout.mode === 'left-side-by-side' && (
             <div style={{ display:'grid', gridTemplateColumns:'minmax(280px, 360px) minmax(0, 1fr)', gap:'16px', alignItems:'start' }}>
               <div style={{ display:'flex', flexDirection:'column', gap:'16px', position:'sticky', top:'76px' }}>
                 {fleetAbilityPanel}
               </div>
               <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:'16px', alignItems:'start' }}>
                 {myBoardPanel}
                 {enemyBoardPanel}
               </div>
             </div>
           )}

           {battleLayout.mode === 'bottom-horizontal' && (
             <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
               <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:'16px', alignItems:'start' }}>
                 {myBoardPanel}
                 {enemyBoardPanel}
               </div>
               {fleetAbilityPanel}
             </div>
           )}
         </>
       ) : (
         <>
           {battleLayout.mode === 'left-stacked' && (
             <div style={{ display:'grid', gridTemplateColumns:'minmax(280px, 360px) minmax(0, 1fr)', gap:'16px', alignItems:'start' }}>
               <div style={{ display:'flex', flexDirection:'column', gap:'16px', position:'sticky', top:'76px' }}>
                 {fleetAbilityPanel}
               </div>
               <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                 {enemyBoardPanel}
                 {myBoardPanel}
               </div>
             </div>
           )}

           {battleLayout.mode === 'left-side-by-side' && (
             <div style={{ display:'grid', gridTemplateColumns:'minmax(280px, 360px) minmax(0, 1fr)', gap:'16px', alignItems:'start' }}>
               <div style={{ display:'flex', flexDirection:'column', gap:'16px', position:'sticky', top:'76px' }}>
                 {fleetAbilityPanel}
               </div>
               <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:'16px', alignItems:'start' }}>
                 {enemyBoardPanel}
                 {myBoardPanel}
               </div>
             </div>
           )}

           {battleLayout.mode === 'bottom-horizontal' && (
             <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
               <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:'16px', alignItems:'start' }}>
                 {enemyBoardPanel}
                 {myBoardPanel}
               </div>
               {fleetAbilityPanel}
             </div>
           )}
         </>
       )}

    </div>
  )
}
