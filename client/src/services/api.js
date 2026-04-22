import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const axiosInstance = axios.create({
  baseURL: BASE_URL,
})

let isRefreshing = false
let failedQueue = []

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
  return config
})

axiosInstance.interceptors.response.use(
  response => response,
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
  get: (id) => axiosInstance.get(`/boards/${id}`),
  create: (data) => axiosInstance.post('/boards', data),
  update: (id, data) => axiosInstance.put(`/boards/${id}`, data),
  delete: (id) => axiosInstance.delete(`/boards/${id}`),
  favorite: (id) => axiosInstance.post(`/boards/${id}/favorite`),
  unfavorite: (id) => axiosInstance.delete(`/boards/${id}/favorite`),
}

export default axiosInstance
