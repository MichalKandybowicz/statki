import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthForm from '../components/auth/AuthForm.jsx'
import useAuth from '../hooks/useAuth'
export default function RegisterPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  async function handleSubmit(email, password) {
    setError(''); setLoading(true)
    try { await register(email, password); navigate('/') }
    catch (err) { setError(err.response?.data?.message || 'Registration failed') }
    finally { setLoading(false) }
  }
  return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'calc(100vh - 60px)', padding:'20px' }}><AuthForm type="register" onSubmit={handleSubmit} error={error} loading={loading} /></div>
}
