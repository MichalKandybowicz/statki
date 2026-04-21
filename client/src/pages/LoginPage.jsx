import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthForm from '../components/auth/AuthForm.jsx'
import useAuth from '../hooks/useAuth'
export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  async function handleSubmit(email, password) {
    setError(''); setLoading(true)
    try { await login(email, password); navigate('/') }
    catch (err) { setError(err.response?.data?.message || 'Login failed') }
    finally { setLoading(false) }
  }
  return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'calc(100vh - 60px)', padding:'20px' }}><AuthForm type="login" onSubmit={handleSubmit} error={error} loading={loading} /></div>
}
