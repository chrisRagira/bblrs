import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'

function fmt(bytes) {
  if (!bytes) return '0 B'
  const units = ['B','KB','MB','GB','TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}

function StatCard({ label, value, sub, accent, delay = '0s' }) {
  return (
    <div style={{ ...s.card, animationDelay: delay }} className="fade-up">
      <span style={s.cardLabel}>{label}</span>
      <span style={{ ...s.cardValue, color: accent ?? 'var(--text)' }}>{value}</span>
      {sub && <span style={s.cardSub}>{sub}</span>}
    </div>
  )
}

function BandwidthBar({ pct }) {
  const color = pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--accent)'
  return (
    <div style={s.barWrap}>
      <div style={{ ...s.barFill, width: `${Math.min(pct, 100)}%`, background: color }} />
    </div>
  )
}

export default function OverviewTab() {
  const [usage, setUsage] = useState(null)
  const [keys, setKeys]   = useState([])
  const [err, setErr]     = useState('')

  useEffect(() => {
    Promise.all([api.usage(), api.keys()])
      .then(([u, k]) => { setUsage(u); setKeys(k) })
      .catch(e => setErr(e.message))
  }, [])

  if (err)    return <div style={s.err}>{err}</div>
  if (!usage) return <div style={s.loading}><span style={s.spinner} /></div>

  const pct = usage.bandwidth_pct ?? 0
  const activeKeys = keys.filter(k => k.active).length

  return (
    <div>
      <div style={s.header} className="fade-up">
        <h2 style={s.title}>Overview</h2>
        <span style={s.period}>{usage.period}</span>
      </div>

      <div style={s.grid}>
        <StatCard label="Bandwidth used"
          value={fmt(usage.bytes_used)}
          sub={usage.bytes_limit ? `of ${fmt(usage.bytes_limit)}` : 'Unlimited'}
          accent="var(--accent2)" delay="0.05s" />
        {/* <StatCard label="Total requests"
          value={usage.requests_total?.toLocaleString() ?? '0'}
          sub="this month" delay="0.10s" />
        <StatCard label="Rate limit"
          value={`${usage.rate_limit_rpm}/min`}
          sub="requests allowed" delay="0.15s" /> */}
        <StatCard label="Active keys"
          value={activeKeys}
          sub="API keys" delay="0.20s" />
      </div>

      {usage.bytes_limit && (
        <div style={s.section} className="fade-up-3">
          <div style={s.bwHeader}>
            <span style={s.sectionTitle}>Bandwidth</span>
            <span style={s.bwPct}>{pct}%</span>
          </div>
          <BandwidthBar pct={pct} />
          <div style={s.bwFooter}>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>{fmt(usage.bytes_used)} used</span>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>{fmt(usage.bytes_limit)} total</span>
          </div>
        </div>
      )}

      <div style={s.section} className="fade-up-4">
        <span style={s.sectionTitle}>Recent Keys</span>
        {keys.length === 0
          ? <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 12 }}>No API keys yet — create one in the API Keys tab.</p>
          : (
            <div style={s.keyList}>
              {keys.slice(0, 3).map(k => (
                <div key={k.id} style={s.keyRow}>
                  <span style={s.keyPrefix}>{k.key_prefix}…</span>
                  <span style={s.keyLabel}>{k.label ?? 'unlabelled'}</span>
                  <span style={{ ...s.badge, background: k.active ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', color: k.active ? 'var(--success)' : 'var(--danger)' }}>
                    {k.active ? 'active' : 'revoked'}
                  </span>
                  <span style={s.keyMeta}>{k.last_used ? `last used ${new Date(k.last_used).toLocaleDateString()}` : 'never used'}</span>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}

const s = {
  header: { display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 28 },
  title: { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em' },
  period: { fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)', background: 'var(--bg3)', padding: '3px 10px', borderRadius: 20 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 16, marginBottom: 32 },
  card: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  cardLabel: { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 },
  cardValue: { fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 },
  cardSub: { fontSize: 12, color: 'var(--muted)', marginTop: 2 },
  section: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '22px 24px', marginBottom: 20 },
  sectionTitle: { fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em', display: 'block', marginBottom: 14 },
  bwHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bwPct: { fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)' },
  bwFooter: { display: 'flex', justifyContent: 'space-between', marginTop: 8 },
  barWrap: { height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, transition: 'width 0.8s ease' },
  keyList: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 },
  keyRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--border)' },
  keyPrefix: { fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent2)', minWidth: 80 },
  keyLabel: { flex: 1, fontSize: 13, color: 'var(--text)' },
  keyMeta: { fontSize: 12, color: 'var(--muted)' },
  badge: { fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500, letterSpacing: '0.04em' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 },
  spinner: { width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'block', animation: 'spin 0.7s linear infinite' },
  err: { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--danger)', borderRadius: 'var(--radius)', padding: '14px 18px', fontSize: 14 },
}
