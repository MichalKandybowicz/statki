import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const axiosInstance = axios.create({
  baseURL: BASE_URL,
})

let isRefreshing = false
let failedQueue = []

function shouldLogRequest(url = '') {
  return ['/ships', '/boards', '/rooms'].some(prefix => String(url).startsWith(prefix))
}

function logApi(level, { method, url, status = '', durationMs = null, message = '' }) {
  const statusPart = status ? ` ${status}` : ''
  const durationPart = durationMs != null ? ` · ${durationMs}ms` : ''
  const messagePart = message ? ` · ${message}` : ''
  console[level](`[API] ${method} ${url}${statusPart}${durationPart}${messagePart}`)
}

function processQueue(error, token = null) {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

axiosInstance.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  config.metadata = {
    ...(config.metadata || {}),
    startedAt: Date.now(),
  }
  if (shouldLogRequest(config.url)) {
    logApi('log', {
      method: (config.method || 'GET').toUpperCase(),
      url: config.url,
      message: 'start',
    })
  }
  return config
})

axiosInstance.interceptors.response.use(
  response => {
    if (shouldLogRequest(response.config?.url)) {
      logApi('log', {
        method: (response.config?.method || 'GET').toUpperCase(),
        url: response.config?.url,
        status: response.status,
        durationMs: Math.max(0, Date.now() - (response.config?.metadata?.startedAt || Date.now())),
        message: 'ok',
      })
    }
    return response
  },
  async error => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return axiosInstance(originalRequest)
        }).catch(err => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        isRefreshing = false
        return Promise.reject(error)
      }

      try {
        const response = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
        const { token, refreshToken: newRefreshToken } = response.data
        localStorage.setItem('token', token)
        localStorage.setItem('refreshToken', newRefreshToken)
        axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`
        originalRequest.headers.Authorization = `Bearer ${token}`
        processQueue(null, token)
        return axiosInstance(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    if (shouldLogRequest(originalRequest?.url)) {
      logApi('error', {
        method: (originalRequest?.method || 'GET').toUpperCase(),
        url: originalRequest?.url,
        status: error.response?.status || '',
        durationMs: originalRequest?.metadata?.startedAt ? Math.max(0, Date.now() - originalRequest.metadata.startedAt) : null,
        message: error.response?.data?.error || error.message || 'request failed',
      })
    }

    return Promise.reject(error)
  }
)

export const auth = {
  register: (email, password, username) => axiosInstance.post('/auth/register', { email, password, username }),
  login: (email, password) => axiosInstance.post('/auth/login', { email, password }),
  refresh: (refreshToken) => axiosInstance.post('/auth/refresh', { refreshToken }),
  getMe: () => axiosInstance.get('/auth/me'),
  updateMe: (data) => axiosInstance.patch('/auth/me', data),
}

export const rooms = {
  list: () => axiosInstance.get('/rooms'),
  create: (data) => axiosInstance.post('/rooms', data),
  get: (id) => axiosInstance.get(`/rooms/${id}`),
  join: (id, data) => axiosInstance.post(`/rooms/${id}/join`, data),
  delete: (id) => axiosInstance.delete(`/rooms/${id}`),
}

export const ships = {
  list: () => axiosInstance.get('/ships'),
  listCommunity: (params = {}) => axiosInstance.get('/ships/community', { params }),
  create: (data) => axiosInstance.post('/ships', data),
  update: (id, data) => axiosInstance.put(`/ships/${id}`, data),
  delete: (id) => axiosInstance.delete(`/ships/${id}`),
  favorite: (id) => axiosInstance.post(`/ships/${id}/favorite`),
  unfavorite: (id) => axiosInstance.delete(`/ships/${id}/favorite`),
  copy: (id, data = {}) => axiosInstance.post(`/ships/${id}/copy`, data),
}

export const boards = {
  list: () => axiosInstance.get('/boards'),
  listCommunity: (params = {}) => axiosInstance.get('/boards/community', { params }),
  get: (id) => axiosInstance.get(`/boards/${id}`),
  create: (data) => axiosInstance.post('/boards', data),
  update: (id, data) => axiosInstance.put(`/boards/${id}`, data),
  delete: (id) => axiosInstance.delete(`/boards/${id}`),
  favorite: (id) => axiosInstance.post(`/boards/${id}/favorite`),
  unfavorite: (id) => axiosInstance.delete(`/boards/${id}/favorite`),
  copy: (id, data = {}) => axiosInstance.post(`/boards/${id}/copy`, data),
}

export const stats = {
  history: (params = {}) => axiosInstance.get('/stats/history', { params }),
  searchPlayers: (q) => axiosInstance.get('/stats/players/search', { params: { q } }),
  headToHead: (opponentId) => axiosInstance.get(`/stats/head-to-head/${opponentId}`),
  leaderboard: (params = {}) => axiosInstance.get('/stats/leaderboard', { params }),
}

export default axiosInstance
