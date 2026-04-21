import { useState, useEffect } from 'react'

export default function TurnTimer({ turnTimeLimit, turnStartedAt }) {
  const [timeLeft, setTimeLeft] = useState(turnTimeLimit)

  useEffect(() => {
    function calc() {
      if (!turnStartedAt || !turnTimeLimit) return turnTimeLimit || 0
      const elapsed = (Date.now() - new Date(turnStartedAt).getTime()) / 1000
      return Math.max(0, Math.ceil(turnTimeLimit - elapsed))
    }
    setTimeLeft(calc())
    const iv = setInterval(() => {
      const t = calc()
      setTimeLeft(t)
      if (t <= 0) clearInterval(iv)
    }, 1000)
    return () => clearInterval(iv)
  }, [turnTimeLimit, turnStartedAt])

  if (!turnTimeLimit) return null
  const urgent = timeLeft <= 10

  return (
    <span style={{ color: urgent ? '#ef4444' : '#94a3b8', fontWeight: urgent ? '700' : '400', fontSize: '0.9rem' }}>
      ⏱ {timeLeft}s
    </span>
  )
}
