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

const SOUND_SETTINGS_KEY = 'statki:sound-settings:v1'
const ABILITY_REVEAL_STEP_MS = 1000
const DEFAULT_SOUND_SETTINGS = {
  masterVolume: 0.8,
  turnEnd: { enabled: true, volume: 0.9, src: '/sounds/turn-end.mp3' },
  hit: { enabled: true, volume: 1, src: '/sounds/hit.mp3' },
  miss: { enabled: true, volume: 0.85, src: '/sounds/miss.mp3' },
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
  const [enemySonarPositions, setEnemySonarPositions] = useState([])
  const [ownSonarPositions, setOwnSonarPositions] = useState([])
  const [targetingMode, setTargetingMode] = useState(null)
  const [selectedShipIndex, setSelectedShipIndex] = useState(0)
  const [linearDirection, setLinearDirection] = useState('horizontal')
  const [linearHoverStart, setLinearHoverStart] = useState(null)
  const [battleLog, setBattleLog] = useState([])
  const [showSoundMenu, setShowSoundMenu] = useState(false)
  const [soundSettings, setSoundSettings] = useState(DEFAULT_SOUND_SETTINGS)
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
      })
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(soundSettings))
  }, [soundSettings])

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
      if (playerId === myId) {
        playShotResultSound(hit || sunk ? 'hit' : 'miss')
      }
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

      if (playerId === myId && shots > 0) {
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

    const onGameOver = ({ winnerId: winner }) => {
      appendLogEntry(winner === myId ? 'Koniec gry: wygrywasz' : 'Koniec gry: przegrywasz', 'over')
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
  }, [socket, myId, appendLogEntry, toCellLabel, playShotResultSound, queueEffect, mergeUniquePositions])

  useEffect(() => {
    if (!myId) return
    const previousTurn = previousTurnRef.current
    if (previousTurn && previousTurn !== turn && previousTurn === myId) {
      const waitMs = Math.max(0, pendingEffectsUntilRef.current - Date.now())
      if (waitMs > 0) {
        queueEffect(() => {
          playTurnEndSound()
          appendLogEntry('Twoja tura dobiegla konca', 'turn')
        }, waitMs + 80)
      } else {
        playTurnEndSound()
        appendLogEntry('Twoja tura dobiegla konca', 'turn')
      }
    }
    previousTurnRef.current = turn
  }, [turn, myId, playTurnEndSound, appendLogEntry, queueEffect])

  useEffect(() => {
    setBattleLog([])
    setEnemySonarPositions([])
    setOwnSonarPositions([])
    previousTurnRef.current = null
    clearPendingEffects()
  }, [gameId, clearPendingEffects])

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
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
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

      <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', marginBottom:'16px' }}>
        <div style={{ flex:1, minWidth:'280px' }}>
          <h3 style={{ color:'#64748b', fontSize:'0.75rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>TWOJA PLANSZA</h3>
          {myBoard && <GameBoard tiles={myBoard} isOwnBoard={true} boardSize={boardSize} sonarPositions={ownSonarPositions} />}
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
              sonarPositions={enemySonarPositions}
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

      <div style={{ marginTop:'16px', background:'#1a2940', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'10px', padding:'14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
          <h3 style={{ color:'#64748b', fontSize:'0.72rem', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', margin:0 }}>Historia walki</h3>
          <button onClick={() => setBattleLog([])} style={{ background:'rgba(255,255,255,0.05)', color:'#94a3b8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', padding:'4px 8px', cursor:'pointer', fontSize:'0.72rem' }}>Wyczysc</button>
        </div>
        {battleLog.length === 0 ? (
          <div style={{ color:'#64748b', fontSize:'0.82rem' }}>Brak wpisow jeszcze.</div>
        ) : (
          <div style={{ maxHeight:'220px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'6px' }}>
            {battleLog.map(entry => (
              <div key={entry.id} style={{ background:'#0f1923', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'6px', padding:'7px 10px' }}>
                <div style={{ color:'#475569', fontSize:'0.68rem', marginBottom:'2px' }}>{new Date(entry.ts).toLocaleTimeString()}</div>
                <div style={{ color:'#cbd5e1', fontSize:'0.8rem', lineHeight:1.4 }}>{entry.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
