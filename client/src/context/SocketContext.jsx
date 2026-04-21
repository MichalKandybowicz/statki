import { createContext, useEffect } from 'react'
import { socket, connectSocket, disconnectSocket } from '../services/socket'
import { AuthContext } from './AuthContext.jsx'
import { useContext } from 'react'

export const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { token } = useContext(AuthContext)

  useEffect(() => {
    if (token) {
      connectSocket(token)
    } else {
      disconnectSocket()
    }
  }, [token])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}
