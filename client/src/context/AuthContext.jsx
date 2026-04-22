import { createContext, useState, useEffect, useCallback } from 'react'
import { auth as authApi } from '../services/api'
import { disconnectSocket } from '../services/socket'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      authApi.getMe()
        .then(res => {
          setUser(res.data)
          setToken(storedToken)
        })
        .catch(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
          setToken(null)
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const res = await authApi.getMe()
    setUser(res.data)
    return res.data
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password)
    const { token: newToken, refreshToken, user: newUser } = res.data
    localStorage.setItem('token', newToken)
    localStorage.setItem('refreshToken', refreshToken)
    setToken(newToken)
    setUser(newUser)
    return newUser
  }, [])

  const register = useCallback(async (email, password, username) => {
    const res = await authApi.register(email, password, username)
    const { token: newToken, refreshToken, user: newUser } = res.data
    localStorage.setItem('token', newToken)
    localStorage.setItem('refreshToken', refreshToken)
    setToken(newToken)
    setUser(newUser)
    return newUser
  }, [])

  const updateProfile = useCallback(async (data) => {
    const res = await authApi.updateMe(data)
    setUser(res.data.user)
    return res.data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    setToken(null)
    setUser(null)
    disconnectSocket()
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
