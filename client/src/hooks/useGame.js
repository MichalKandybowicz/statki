import { useContext } from 'react'
import { GameContext } from '../context/GameContext.jsx'
export default function useGame() { return useContext(GameContext) }
