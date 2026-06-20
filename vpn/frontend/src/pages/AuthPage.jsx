import { useState } from 'react'
import { api, saveToken, saveUser } from '../lib/api.js'

export default function AuthPage({ onAuth }) {
  const [mode, setMode]   = useState('login')
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      const fn = mode === 'login' ? api.login : api.register
      const data = await fn(email, pass)
      saveToken(data.token)
      saveUser(data.user)
      onAuth()
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.root}>
      {/* Left panel */}
      <div style={styles.left}>
        <div style={styles.logoArea}>
          <span style={styles.logoMark}>P</span>
          <span style={styles.logoText}>ProxyAaS</span>
        </div>
        <div style={styles.tagline}>
          <h1 style={styles.hero}>Route the world<br/>through your IP.</h1>
          <p style={styles.sub}>
            High-performance HTTP/HTTPS proxy infrastructure.
            API-key authenticated. Usage-tracked. Instantly deployable.
          </p>
        </div>
        <div style={styles.stats}>
          {[['3128', 'proxy port'], ['99.9%', 'uptime SLA'], ['<5ms', 'auth latency']].map(([v, l]) => (
            <div key={l} style={styles.stat}>
              <span style={styles.statVal}>{v}</span>
              <span style={styles.statLabel}>{l}</span>
            </div>
          ))}
        </div>
        <div style={styles.grid} aria-hidden />
      </div>

      {/* Right panel */}
      <div style={styles.right}>
        <div style={styles.card} className="fade-up">
          <div style={styles.tabs}>
            {['login', 'register'].map(m => (
              <button key={m} style={{ ...styles.tab, ...(mode === m ? styles.tabActive : {}) }}
                onClick={() => { setMode(m); setErr('') }}>
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={styles.form}>
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" required autoFocus
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" />

            <label style={styles.label}>Password</label>
            <input style={styles.input} type="password" required
              value={pass} onChange={e => setPass(e.target.value)}
              placeholder={mode === 'register' ? 'Min 8 characters' : '••••••••'}
              minLength={mode === 'register' ? 8 : undefined} />

            {err && <div style={styles.error}>{err}</div>}

            <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
              type="submit" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in →' : 'Create account →'}
            </button>
          </form>

          <p style={styles.hint}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button style={styles.link} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr('') }}>
              {mode === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  root: {
    minHeight: '100vh', display: 'flex',
  },
  left: {
    flex: 1, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
    padding: '48px 56px', display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between', position: 'relative', overflow: 'hidden',
    minHeight: '100vh',
  },
  logoArea: { display: 'flex', alignItems: 'center', gap: 12 },
  logoMark: {
    width: 36, height: 36, background: 'var(--accent)', borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 18, color: '#fff',
  },
  logoText: { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' },
  tagline: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 },
  hero: {
    fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 'clamp(32px, 3.5vw, 52px)',
    lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 20,
  },
  sub: { color: 'var(--muted)', fontSize: 16, maxWidth: 380, lineHeight: 1.7 },
  stats: { display: 'flex', gap: 40, paddingTop: 40, borderTop: '1px solid var(--border)' },
  stat: { display: 'flex', flexDirection: 'column', gap: 2 },
  statVal: { fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: 'var(--accent2)' },
  statLabel: { fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  // decorative grid
  grid: {
    position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.04,
    backgroundImage: 'linear-gradient(var(--text) 1px, transparent 1px), linear-gradient(90deg, var(--text) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
  },
  right: {
    width: 440, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '40px 32px', background: 'var(--bg)',
  },
  card: { width: '100%', maxWidth: 360 },
  tabs: { display: 'flex', gap: 0, marginBottom: 32, borderBottom: '1px solid var(--border)' },
  tab: {
    flex: 1, background: 'none', border: 'none', color: 'var(--muted)',
    fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 14,
    padding: '10px 0', cursor: 'pointer', letterSpacing: '0.02em',
    borderBottom: '2px solid transparent', marginBottom: -1, transition: 'all 0.2s',
  },
  tabActive: { color: 'var(--text)', borderBottomColor: 'var(--accent)' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  label: { fontSize: 12, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  input: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 15, padding: '10px 14px',
    outline: 'none', transition: 'border-color 0.2s', width: '100%',
  },
  error: {
    background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
    color: 'var(--danger)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13,
  },
  btn: {
    background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)',
    fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 15, padding: '12px 20px',
    cursor: 'pointer', marginTop: 8, transition: 'opacity 0.2s, transform 0.1s', letterSpacing: '0.01em',
  },
  hint: { marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--muted)' },
  link: {
    background: 'none', border: 'none', color: 'var(--accent2)', cursor: 'pointer',
    fontSize: 13, fontFamily: 'var(--font-body)', textDecoration: 'underline',
  },
}
