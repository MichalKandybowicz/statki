import { createContext, useState, useCallback, useEffect, useContext } from 'react'
import { SocketContext } from './SocketContext.jsx'
import { AuthContext } from './AuthContext.jsx'

export const GameContext = createContext(null)

export function GameProvider({ children }) {
  const socket = useContext(SocketContext)
  const { user } = useContext(AuthContext)

  const [gameId, setGameId] = useState(null)
  const [boardSize, setBoardSize] = useState(10)
  const [boards, setBoards] = useState({})
  const [myFleet, setMyFleet] = useState([])
  const [turn, setTurn] = useState(null)
  const [turnStartedAt, setTurnStartedAt] = useState(null)
  const [status, setStatus] = useState(null)
  const [winnerId, setWinnerId] = useState(null)
  const [players, setPlayers] = useState([])
  const [skips, setSkips] = useState({})

  const setGameData = useCallback((data) => {
    if (data.gameId) setGameId(data.gameId)
    if (data.boardSize) setBoardSize(data.boardSize)
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
    if (data.winnerId !== undefined) setWinnerId(data.winnerId)
    if (data.players) setPlayers(data.players)
    if (data.skips) setSkips(data.skips)
  }, [])

  const clearGame = useCallback(() => {
    setGameId(null)
    setBoardSize(10)
    setBoards({})
    setMyFleet([])
    setTurn(null)
    setTurnStartedAt(null)
    setStatus(null)
    setWinnerId(null)
    setPlayers([])
    setSkips({})
  }, [])

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
      setGameId(data.gameId)
      setBoardSize(data.boardSize)
      setBoards(normaliseBoardData(data.boards))
      setTurn(data.turn)
      setTurnStartedAt(data.turnStartedAt)
      setPlayers(data.players || [])
      setStatus('playing')
    }

    const handleGameState = (data) => {
      if (data.gameId) setGameId(data.gameId)
      if (data.boardSize) setBoardSize(data.boardSize)
      if (data.boards) setBoards(normaliseBoardData(data.boards))
      if (data.fleet) setMyFleet(data.fleet)
      if (data.turn !== undefined) setTurn(data.turn)
      if (data.turnStartedAt) setTurnStartedAt(data.turnStartedAt)
      if (data.status) setStatus(data.status)
      if (data.winnerId !== undefined) setWinnerId(data.winnerId)
      if (data.players) setPlayers(data.players)
      if (data.skips) setSkips(data.skips)
    }

    const handleMoveResult = ({ playerId, x, y, hit, sunk }) => {
      if (!user) return
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

    const handleAbilityResult = ({ results, playerId }) => {
      if (!user || !results) return
      setBoards(prev => {
        const targetId = playerId === user._id
          ? Object.keys(prev).find(id => id !== user._id)
          : user._id

        if (!targetId || !prev[targetId]) return prev

        const board = prev[targetId].map(row => [...row])
        results.forEach(({ x, y, hit, sunk }) => {
          board[y][x] = sunk ? 'sunk' : hit ? 'hit' : 'miss'
        })
        return { ...prev, [targetId]: board }
      })
    }

    const handleTurnUpdate = ({ turn: newTurn, turnStartedAt: newTsa, skips: newSkips }) => {
      setTurn(newTurn)
      setTurnStartedAt(newTsa)
      if (newSkips) setSkips(newSkips)
    }

    const handleGameOver = ({ winnerId: wid }) => {
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
      socket.off('game_start', handleGameStart)
      socket.off('game_state', handleGameState)
      socket.off('move_result', handleMoveResult)
      socket.off('ability_result', handleAbilityResult)
      socket.off('turn_update', handleTurnUpdate)
      socket.off('game_over', handleGameOver)
    }
  }, [socket, user])

  return (
    <GameContext.Provider value={{
      gameId, boardSize, boards, myFleet, turn, turnStartedAt,
      status, winnerId, players, skips, setGameData, clearGame,
    }}>
      {children}
    </GameContext.Provider>
  )
}
