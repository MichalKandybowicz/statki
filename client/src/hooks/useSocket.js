import { useContext } from 'react'
import { SocketContext } from '../context/SocketContext.jsx'
export default function useSocket() { return useContext(SocketContext) }
