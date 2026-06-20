import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'

export default function KeysTab() {
  const [keys, setKeys]     = useState([])
  const [label, setLabel]   = useState('')
  const [newKey, setNewKey] = useState(null)   // revealed once after creation
  const [copied, setCopied] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr]       = useState('')
  const host = window.location.hostname === 'localhost' ? 'your-server-ip' : window.location.hostname
  const [nodes, setNodes] = useState([])
  const [location, setLocation] = useState('United States')


  async function load() {
    try { setKeys(await api.keys()) } catch (e) { setErr(e.message) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    async function loadNodes() {
      const data = await api.proxyNodes()
      setNodes(data)
    }

    loadNodes()
  }, [])

  async function create(e) {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      const k = await api.createKey(label,location)
      setNewKey(k)
      setLabel('')
      await load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function revoke(id) {
    if (!confirm('Revoke this key? Any applications using it will stop working.')) return
    try { await api.revokeKey(id); await load() } catch (e) { setErr(e.message) }
  }

  function copy(text, id) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div>
      <div style={s.header} className="fade-up">
        <div>
          <h2 style={s.title}>API Keys</h2>
          <p style={s.sub}>Keys authenticate your proxy connections. Use the key as both username and password.</p>
        </div>
      </div>

      {/* New key revealed */}
      {newKey && (
        <div style={s.revealed} className="fade-up">
          <div style={s.revealedHeader}>
            <span style={s.revealedTitle}>⚠ Save this key — it won't be shown again</span>
            <button style={s.closeBtn} onClick={() => setNewKey(null)}>✕</button>
          </div>
          <div style={s.keyReveal}>
            <code style={s.keyCode}>{newKey.key}</code>
            <button style={s.copyBtn} onClick={() => copy(newKey.key, 'new')}>
              {copied === 'new' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      <form onSubmit={create} style={s.createForm} className="fade-up-2">
        <select
          style={s.select}
          value={location}
          onChange={e => setLocation(e.target.value)}
        >
          {nodes.map(n => (
            <option key={n.label} value={n.label}>
              {n.label}
            </option>
          ))}
        </select>
        <input style={s.input} type="text" placeholder="Key label (e.g. laptop, server-1)"
          value={label} onChange={e => setLabel(e.target.value)} />
        <button style={{ ...s.createBtn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
          {loading ? 'Creating…' : '+ New Key'}
        </button>
      </form>

      {err && <div style={s.err} className="fade-up">{err}</div>}

      {/* Key list */}
      <div style={s.list} className="fade-up-3">
        {keys.length === 0
          ? <p style={s.empty}>No keys yet. Create one above.</p>
          : keys.map(k => (
            <div key={k.id} style={s.keyCard}>
              <div style={s.keyTop}>
                <div style={s.keyLeft}>
                  <span style={s.prefix}>{k.key_prefix}{'─'.repeat(32)}</span>
                  <span style={{ ...s.badge, ...(k.active ? s.badgeActive : s.badgeRevoked) }}>
                    {k.active ? 'active' : 'revoked'}
                  </span>
                  <span style={s.metaItem}>
                    <span style={s.metaLabel}>Location</span>
                    <span style={s.metaVal}>{k.location?.toUpperCase() || 'UNITED STATES'}</span>
                  </span>
                </div>
                {k.active && (
                  <button style={s.revokeBtn} onClick={() => revoke(k.id)}>Revoke</button>
                )}
              </div>
              <div style={s.keyMeta}>
                <span style={s.metaItem}>
                  <span style={s.metaLabel}>Label</span>
                  <span style={s.metaVal}>{k.label ?? '—'}</span>
                </span>
                <span style={s.metaItem}>
                  <span style={s.metaLabel}>Created</span>
                  <span style={s.metaVal}>{new Date(k.created_at).toLocaleDateString()}</span>
                </span>
                <span style={s.metaItem}>
                  <span style={s.metaLabel}>Last used</span>
                  <span style={s.metaVal}>{k.last_used ? new Date(k.last_used).toLocaleDateString() : 'Never'}</span>
                </span>
              </div>
            </div>
          ))
        }
      </div>

      {/* Usage instructions */}
      <div style={s.howto} className="fade-up-4">
        <h3 style={s.howtoTitle}>Using your proxy</h3>
        <div style={s.codeBlock}>
          <div style={s.codeLine}>
            <span style={s.codeComment}># curl</span>
          </div>
          <div style={s.codeLine}>
            <span style={s.codeText}>{`curl -x http://${host}:3128 -U "pak_...:pak_..." https://api.ipify.org`}</span>
          </div>
          <div style={s.codeLine}>&nbsp;</div>
          <div style={s.codeLine}>
            <span style={s.codeComment}># Browser / app settings</span>
          </div>
          <div style={s.codeLine}>
            <span style={s.codeKey}>Host:</span><span style={s.codeText}> {host}</span>
          </div>
          <div style={s.codeLine}>
            <span style={s.codeKey}>Port:</span><span style={s.codeText}> 3128</span>
          </div>
          <div style={s.codeLine}>
            <span style={s.codeKey}>Username:</span><span style={s.codeText}> {'<your API key>'}</span>
          </div>
          <div style={s.codeLine}>
            <span style={s.codeKey}>Password:</span><span style={s.codeText}> {'<your API key>'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  header: { marginBottom: 28 },
  title: { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', marginBottom: 6 },
  sub: { color: 'var(--muted)', fontSize: 14 },
  revealed: {
    background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)',
    borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 20,
  },
  revealedHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  revealedTitle: { fontSize: 13, fontWeight: 600, color: 'var(--warning)' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 },
  keyReveal: { display: 'flex', gap: 12, alignItems: 'center' },
  keyCode: {
    fontFamily: 'var(--font-mono)', fontSize: 13, background: 'var(--bg3)',
    padding: '8px 14px', borderRadius: 'var(--radius)', flex: 1,
    color: 'var(--accent2)', wordBreak: 'break-all',
  },
  copyBtn: {
    background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)',
    borderRadius: 'var(--radius)', padding: '8px 16px', cursor: 'pointer',
    fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap',
  },
  createForm: { display: 'flex', gap: 12, marginBottom: 24 },
  input: {
    flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text)', fontFamily: 'var(--font-body)',
    fontSize: 14, padding: '10px 14px', outline: 'none',
  },
  createBtn: {
    background: 'var(--accent)', color: '#fff', border: 'none',
    borderRadius: 'var(--radius)', fontFamily: 'var(--font-head)', fontWeight: 700,
    fontSize: 14, padding: '10px 20px', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  err: {
    background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
    color: 'var(--danger)', borderRadius: 'var(--radius)', padding: '10px 14px',
    fontSize: 13, marginBottom: 16,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 },
  empty: { color: 'var(--muted)', fontSize: 14, padding: '20px 0' },
  keyCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '18px 20px',
  },
  keyTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  keyLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  prefix: { fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent2)', letterSpacing: '0.05em' },
  badge: { fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500 },
  badgeActive: { background: 'rgba(52,211,153,0.12)', color: 'var(--success)' },
  badgeRevoked: { background: 'rgba(107,107,128,0.15)', color: 'var(--muted)' },
  revokeBtn: {
    background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
    borderRadius: 'var(--radius)', padding: '5px 12px', cursor: 'pointer',
    fontSize: 12, fontFamily: 'var(--font-body)', transition: 'all 0.15s',
  },
  keyMeta: { display: 'flex', gap: 28 },
  metaItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  metaLabel: { fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  metaVal: { fontSize: 13, color: 'var(--text)' },
  howto: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '22px 24px',
  },
  howtoTitle: { fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 15, marginBottom: 16 },
  codeBlock: {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '16px 18px', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.9,
  },
  codeLine: { display: 'flex' },
  codeComment: { color: 'var(--muted)' },
  codeKey: { color: 'var(--accent2)', minWidth: 90 },
  codeText: { color: 'var(--text)' },
  select: {
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  padding: '10px 14px',
  outline: 'none',
  minWidth: 180,
  cursor: 'pointer',
},
}
