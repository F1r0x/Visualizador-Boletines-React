import { useState } from 'react'

export default function LoginScreen({ onLogin, error, setError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError?.('')
    if (!email.trim() || !password) {
      setError?.('Introduce email y contraseña.')
      return
    }
    setBusy(true)
    try {
      await onLogin(email, password)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">B</div>
          <h1>Boletines de Servicio</h1>
          <p>Acceso restringido a técnicos autorizados</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              disabled={busy}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={busy}
              required
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn login-btn" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="login-hint">
          El usuario se crea en Supabase → Authentication → Users.
        </p>
      </div>
    </div>
  )
}
