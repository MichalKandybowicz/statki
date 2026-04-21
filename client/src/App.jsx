import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/layout/Navbar.jsx'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import LobbyPage from './pages/LobbyPage.jsx'
import ShipBuilderPage from './pages/ShipBuilderPage.jsx'
import BoardBuilderPage from './pages/BoardBuilderPage.jsx'
import GameSetupPage from './pages/GameSetupPage.jsx'
import GamePage from './pages/GamePage.jsx'

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/ships" element={<ProtectedRoute><ShipBuilderPage /></ProtectedRoute>} />
        <Route path="/boards" element={<ProtectedRoute><BoardBuilderPage /></ProtectedRoute>} />
        <Route path="/room/:roomId/setup" element={<ProtectedRoute><GameSetupPage /></ProtectedRoute>} />
        <Route path="/game/:gameId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
