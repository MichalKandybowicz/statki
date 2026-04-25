import { createContext, useState, useCallback, useEffect, useContext, useRef } from 'react'
import { SocketContext } from './SocketContext.jsx'
import { AuthContext } from './AuthContext.jsx'

export const GameContext = createContext(null)
const ABILITY_REVEAL_STEP_MS = 1000

export function GameProvider({ children }) {
  const socket = useContext(SocketContext)
  const { user } = useContext(AuthContext)

  const [gameId, setGameId] = useState(null)
  const [boardSize, setBoardSize] = useState(10)
  const [turnTimeLimit, setTurnTimeLimit] = useState(60)
  const [boards, setBoards] = useState({})
  const [myFleet, setMyFleet] = useState([])
  const [turn, setTurn] = useState(null)
  const [turnStartedAt, setTurnStartedAt] = useState(null)
  const [status, setStatus] = useState(null)
  const [isRanked, setIsRanked] = useState(false)
  const [winnerId, setWinnerId] = useState(null)
  const [players, setPlayers] = useState([])
  const [skips, setSkips] = useState({})
  const pendingAbilityTimeoutsRef = useRef([])

  const clearPendingAbilityEffects = useCallback(() => {
    pendingAbilityTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId))
    pendingAbilityTimeoutsRef.current = []
  }, [])

  const setGameData = useCallback((data) => {
    clearPendingAbilityEffects()
    if (data.gameId) setGameId(data.gameId)
    if (data.boardSize) setBoardSize(data.boardSize)
    if (data.turnTimeLimit) setTurnTimeLimit(data.turnTimeLimit)
    if (data.boards) {
      const normalised = {}
      Object.entries(data.boards).forEach(([pid, boardData]) => {
        normalised[pid] = Array.isArray(boardData) ? boardData : boardData.board
      })
      setBoards(normalised)
    }
    if (data.fleet) setMyFleet(data.fleet)
    if (data.turn !== undefined) setTurn(data.turn)
    if (data.turnStartedAt) setTurnStartedAt(data.turnStartedAt)
    if (data.status) setStatus(data.status)
    if (data.isRanked !== undefined) setIsRanked(!!data.isRanked)
    if (data.winnerId !== undefined) setWinnerId(data.winnerId)
    if (data.players) setPlayers(data.players)
    if (data.skips) setSkips(data.skips)
  }, [clearPendingAbilityEffects])

  const clearGame = useCallback(() => {
    clearPendingAbilityEffects()
    setGameId(null)
    setBoardSize(10)
    setTurnTimeLimit(60)
    setBoards({})
    setMyFleet([])
    setTurn(null)
    setTurnStartedAt(null)
    setStatus(null)
    setIsRanked(false)
    setWinnerId(null)
    setPlayers([])
    setSkips({})
  }, [clearPendingAbilityEffects])

  useEffect(() => {
    if (!socket) return

    function normaliseBoardData(rawBoards) {
      const result = {}
      Object.entries(rawBoards).forEach(([pid, boardData]) => {
        result[pid] = Array.isArray(boardData) ? boardData : boardData.board
      })
      return result
    }

    const handleGameStart = (data) => {
      clearPendingAbilityEffects()
      setGameId(data.gameId)
      setBoardSize(data.boardSize)
      if (data.turnTimeLimit) setTurnTimeLimit(data.turnTimeLimit)
      setBoards(normaliseBoardData(data.boards))
      setMyFleet(data.fleet || [])
      setTurn(data.turn)
      setTurnStartedAt(data.turnStartedAt)
      setPlayers(data.players || [])
      setStatus(data.status || 'in_game')
      setIsRanked(!!data.isRanked)
      if (data.skips) setSkips(data.skips)
    }

    const handleGameState = (data) => {
      clearPendingAbilityEffects()
      if (data.gameId) setGameId(data.gameId)
      if (data.boardSize) setBoardSize(data.boardSize)
      if (data.turnTimeLimit) setTurnTimeLimit(data.turnTimeLimit)
      if (data.boards) setBoards(normaliseBoardData(data.boards))
      if (data.fleet) setMyFleet(data.fleet)
      if (data.turn !== undefined) setTurn(data.turn)
      if (data.turnStartedAt) setTurnStartedAt(data.turnStartedAt)
      if (data.status) setStatus(data.status)
      if (data.isRanked !== undefined) setIsRanked(!!data.isRanked)
      if (data.winnerId !== undefined) setWinnerId(data.winnerId)
      if (data.players) setPlayers(data.players)
      if (data.skips) setSkips(data.skips)
    }

    const handleMoveResult = ({ playerId, x, y, hit, sunk, boards: payloadBoards, fleet }) => {
      if (!user) return
      clearPendingAbilityEffects()
      if (payloadBoards) setBoards(normaliseBoardData(payloadBoards))
      if (fleet) setMyFleet(fleet)

      if (payloadBoards) return

      setBoards(prev => {
        // Attacker is playerId. Their shot lands on the OTHER player's board.
        const targetId = playerId === user._id
          ? Object.keys(prev).find(id => id !== user._id)
          : user._id

        if (!targetId || !prev[targetId]) return prev

        const board = prev[targetId].map(row => [...row])
        board[y][x] = sunk ? 'sunk' : hit ? 'hit' : 'miss'

        return { ...prev, [targetId]: board }
      })
    }

    const handleAbilityResult = ({ abilityType, results, playerId, boards: payloadBoards, fleet }) => {
      if (!user) return
      const shots = Array.isArray(results) ? results : []
      const abilityStartDelayMs = abilityType === 'holy_bomb' ? 1000 : 0
      if (fleet) setMyFleet(fleet)

      if (shots.length === 0) {
        if (payloadBoards) setBoards(normaliseBoardData(payloadBoards))
        return
      }

      clearPendingAbilityEffects()

      const applyShotToBoard = ({ x, y, hit, sunk }) => {
        setBoards(prev => {
          const targetId = playerId === user._id
            ? Object.keys(prev).find(id => id !== user._id)
            : user._id

          if (!targetId || !prev[targetId]) return prev
          if (!prev[targetId][y] || prev[targetId][y][x] === undefined) return prev

          const board = prev[targetId].map(row => [...row])
          board[y][x] = sunk ? 'sunk' : hit ? 'hit' : 'miss'
          return { ...prev, [targetId]: board }
        })
      }

      shots.forEach((shot, index) => {
        const timeoutId = setTimeout(() => {
          applyShotToBoard(shot)
        }, abilityStartDelayMs + index * ABILITY_REVEAL_STEP_MS)
        pendingAbilityTimeoutsRef.current.push(timeoutId)
      })

      if (payloadBoards) {
        const syncTimeoutId = setTimeout(() => {
          setBoards(normaliseBoardData(payloadBoards))
        }, abilityStartDelayMs + shots.length * ABILITY_REVEAL_STEP_MS + 10)
        pendingAbilityTimeoutsRef.current.push(syncTimeoutId)
      }
    }

    const handleTurnUpdate = ({ turn: newTurn, turnStartedAt: newTsa, skips: newSkips, fleet }) => {
      setTurn(newTurn)
      setTurnStartedAt(newTsa)
      if (newSkips) setSkips(newSkips)
      if (fleet) setMyFleet(fleet)
    }

    const handleGameOver = ({ winnerId: wid }) => {
      clearPendingAbilityEffects()
      setWinnerId(wid)
      setStatus('finished')
    }

    socket.on('game_start', handleGameStart)
    socket.on('game_state', handleGameState)
    socket.on('move_result', handleMoveResult)
    socket.on('ability_result', handleAbilityResult)
    socket.on('turn_update', handleTurnUpdate)
    socket.on('game_over', handleGameOver)

    return () => {
      clearPendingAbilityEffects()
      socket.off('game_start', handleGameStart)
      socket.off('game_state', handleGameState)
      socket.off('move_result', handleMoveResult)
      socket.off('ability_result', handleAbilityResult)
      socket.off('turn_update', handleTurnUpdate)
      socket.off('game_over', handleGameOver)
    }
  }, [socket, user, clearPendingAbilityEffects])

  return (
    <GameContext.Provider value={{
      gameId, boardSize, boards, myFleet, turn, turnStartedAt,
      turnTimeLimit, status, isRanked, winnerId, players, skips, setGameData, clearGame,
    }}>
      {children}
    </GameContext.Provider>
  )
}
