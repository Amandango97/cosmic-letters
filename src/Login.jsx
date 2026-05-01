// Login.jsx — password login for person A or B
// Passwords are set as Supabase user accounts (see SETUP.md)

import { useState } from 'react'
import { supabase } from './supabase'

export default function Login({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) { setError(err.message); return }
    onLogin(data.user)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <p className="login-title">letters</p>
        <p className="login-sub">across space &amp; time</p>
        <form onSubmit={handleLogin}>
          <input
            className="login-field"
            type="email"
            placeholder="your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            className="login-field"
            type="password"
            placeholder="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <p className="login-error">{error}</p>
          <button className="btn btn-accent" style={{ width: '100%', padding: '10px' }} disabled={loading}>
            {loading ? 'opening…' : 'enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
