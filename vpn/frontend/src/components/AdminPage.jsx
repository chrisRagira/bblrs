import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.js'

function fmt(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const u = ['B','KB','MB','GB','TB']
  const i = Math.floor(Math.log(Math.max(bytes,1)) / Math.log(1024))
  return `${(bytes / 1024**i).toFixed(1)} ${u[i]}`
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={s.statCard}>
      <span style={s.statLabel}>{label}</span>
      <span style={{ ...s.statValue, color: color ?? 'var(--text)' }}>{value}</span>
      {sub && <span style={s.statSub}>{sub}</span>}
    </div>
  )
}

const PLANS = ['free', 'starter', 'pro', 'business']

export default function AdminPage() {
  const [stats, setStats]     = useState(null)
  const [users, setUsers]     = useState([])
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')
  const [msg, setMsg]         = useState('')
  const [activeTab, setTab]   = useState('stats')

  useEffect(() => {
    api.adminStats()
      .then(setStats)
      .catch(e => setErr(e.message))
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.adminUsers(page, search)
      setUsers(data)
    } catch(e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    if (activeTab === 'users') loadUsers()
  }, [activeTab, loadUsers])

  async function setPlan(id, plan_name) {
    try {
      await api.adminSetPlan(id, plan_name)
      setMsg(`Plan updated to ${plan_name}`)
      loadUsers()
      setTimeout(() => setMsg(''), 3000)
    } catch(e) { setErr(e.message) }
  }

  async function suspend(id, email) {
    if (!confirm(`Suspend ${email}? They will lose proxy access immediately.`)) return
    try {
      await api.adminSuspend(id)
      setMsg(`${email} suspended`)
      loadUsers()
      setTimeout(() => setMsg(''), 3000)
    } catch(e) { setErr(e.message) }
  }

  return (
    <div>
      <div style={s.header} className="fade-up">
        <div>
          <h2 style={s.title}>Admin</h2>
          <p style={s.sub}>System overview and user management.</p>
        </div>
        <div style={s.adminBadge}>ADMIN</div>
      </div>

      {err && <div style={s.err} className="fade-up">{err} <button style={s.errClose} onClick={() => setErr('')}>✕</button></div>}
      {msg && <div style={s.success} className="fade-up">✓ {msg}</div>}

      {/* Tabs */}
      <div style={s.tabs} className="fade-up-2">
        {[['stats', 'System Stats'], ['users', 'Users']].map(([id, label]) => (
          <button key={id} style={{ ...s.tab, ...(activeTab === id ? s.tabActive : {}) }}
            onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* ── Stats tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'stats' && (
        <div className="fade-up-3">
          {!stats
            ? <div style={s.loading}><span style={s.spinner} /></div>
            : <>
              <div style={s.grid}>
                <StatCard label="Active users"   value={stats.users?.active_users ?? 0} color="var(--success)" />
                <StatCard label="Total users"    value={stats.users?.total_users ?? 0} />
                <StatCard label="New this week"  value={stats.users?.new_this_week ?? 0} color="var(--accent2)" />
                <StatCard label="Bandwidth (mo)" value={fmt(stats.usage_this_month?.total_bytes ?? 0)} />
                <StatCard label="Requests (mo)"  value={(stats.usage_this_month?.total_requests ?? 0).toLocaleString()} />
              </div>

              {/* By plan breakdown */}
              {stats.users?.by_plan && (
                <div style={s.section}>
                  <h3 style={s.sectionTitle}>Users by plan</h3>
                  <div style={s.planGrid}>
                    {Object.entries(stats.users.by_plan).map(([plan, count]) => (
                      <div key={plan} style={s.planCard}>
                        <span style={s.planName}>{plan}</span>
                        <span style={s.planCount}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top users */}
              {stats.top_users_by_bandwidth?.length > 0 && (
                <div style={s.section}>
                  <h3 style={s.sectionTitle}>Top users by bandwidth this month</h3>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        {['Email','Plan','Bandwidth','Requests'].map(h => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.top_users_by_bandwidth.map((u, i) => (
                        <tr key={i} style={s.tr}>
                          <td style={s.td}>{u.email}</td>
                          <td style={s.td}><span style={{ ...s.badge, ...planBadge(u.plan) }}>{u.plan}</span></td>
                          <td style={{ ...s.td, fontFamily: 'var(--font-mono)', fontSize: 13 }}>{fmt(u.bytes_total)}</td>
                          <td style={{ ...s.td, fontFamily: 'var(--font-mono)', fontSize: 13 }}>{(u.req_total ?? 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          }
        </div>
      )}

      {/* ── Users tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="fade-up-3">
          <div style={s.searchRow}>
            <input style={s.searchInput} type="text" placeholder="Search by email…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            <button style={s.searchBtn} onClick={loadUsers}>Search</button>
          </div>

          {loading
            ? <div style={s.loading}><span style={s.spinner} /></div>
            : (
              <div style={s.section}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Email','Plan','Keys','Status','Joined','Actions'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ ...s.tr, opacity: u.active ? 1 : 0.5 }}>
                        <td style={s.td}>
                          <span style={s.userEmail}>{u.email}</span>
                        </td>
                        <td style={s.td}>
                          <select style={s.planSelect}
                            value={u.plan} onChange={e => setPlan(u.id, e.target.value)}>
                            {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td style={{ ...s.td, fontFamily: 'var(--font-mono)', fontSize: 13 }}>{u.key_count}</td>
                        <td style={s.td}>
                          <span style={{ ...s.badge, ...(u.active ? s.badgeActive : s.badgeSuspended) }}>
                            {u.active ? 'active' : 'suspended'}
                          </span>
                        </td>
                        <td style={{ ...s.td, fontSize: 12, color: 'var(--muted)' }}>
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td style={s.td}>
                          {u.active && (
                            <button style={s.suspendBtn} onClick={() => suspend(u.id, u.email)}>
                              Suspend
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                <div style={s.pagination}>
                  <button style={s.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                  <span style={s.pageNum}>Page {page}</span>
                  <button style={s.pageBtn} disabled={users.length < 20} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}

function planBadge(plan) {
  const map = {
    free:     { background: 'rgba(107,107,128,0.15)', color: 'var(--muted)' },
    starter:  { background: 'rgba(52,211,153,0.1)',   color: 'var(--success)' },
    pro:      { background: 'rgba(124,109,250,0.15)', color: 'var(--accent2)' },
    business: { background: 'rgba(251,191,36,0.1)',   color: 'var(--warning)' },
  }
  return map[plan] ?? map.free
}

const s = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 },
  title: { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', marginBottom: 6 },
  sub: { color: 'var(--muted)', fontSize: 14 },
  adminBadge: {
    background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
    color: 'var(--danger)', borderRadius: 20, padding: '4px 12px',
    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)',
  },
  err: {
    background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
    color: 'var(--danger)', borderRadius: 'var(--radius)', padding: '10px 14px',
    fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  errClose: { background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14 },
  success: {
    background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
    color: 'var(--success)', borderRadius: 'var(--radius)', padding: '10px 14px',
    fontSize: 13, marginBottom: 16,
  },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 28, gap: 0 },
  tab: {
    background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'var(--font-head)',
    fontWeight: 600, fontSize: 14, padding: '10px 20px', cursor: 'pointer',
    borderBottom: '2px solid transparent', marginBottom: -1, transition: 'all 0.15s',
    letterSpacing: '0.02em',
  },
  tabActive: { color: 'var(--text)', borderBottomColor: 'var(--accent)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 24 },
  statCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  statLabel: { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' },
  statValue: { fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' },
  statSub: { fontSize: 12, color: 'var(--muted)' },
  section: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    padding: '22px 24px', marginBottom: 20, overflowX: 'auto',
  },
  sectionTitle: { fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 14, marginBottom: 16 },
  planGrid: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  planCard: {
    background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100,
  },
  planName: { fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  planCount: { fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 700 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 600 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)', fontWeight: 500 },
  tr: { borderBottom: '1px solid var(--border)', transition: 'background 0.1s' },
  td: { padding: '12px 12px', fontSize: 14, color: 'var(--text)', verticalAlign: 'middle' },
  badge: { fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 500, whiteSpace: 'nowrap' },
  badgeActive: { background: 'rgba(52,211,153,0.12)', color: 'var(--success)' },
  badgeSuspended: { background: 'rgba(248,113,113,0.1)', color: 'var(--danger)' },
  searchRow: { display: 'flex', gap: 12, marginBottom: 20 },
  searchInput: {
    flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 14, padding: '10px 14px', outline: 'none',
  },
  searchBtn: {
    background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text)',
    borderRadius: 'var(--radius)', padding: '10px 20px', cursor: 'pointer',
    fontFamily: 'var(--font-body)', fontSize: 14,
  },
  userEmail: { fontFamily: 'var(--font-mono)', fontSize: 13 },
  planSelect: {
    background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)',
    borderRadius: 'var(--radius)', padding: '4px 8px', fontSize: 13,
    fontFamily: 'var(--font-body)', cursor: 'pointer', outline: 'none',
  },
  suspendBtn: {
    background: 'none', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--danger)',
    borderRadius: 'var(--radius)', padding: '4px 12px', cursor: 'pointer',
    fontSize: 12, fontFamily: 'var(--font-body)', transition: 'all 0.15s',
  },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 20 },
  pageBtn: {
    background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)',
    borderRadius: 'var(--radius)', padding: '6px 16px', cursor: 'pointer',
    fontFamily: 'var(--font-body)', fontSize: 13, transition: 'all 0.15s',
  },
  pageNum: { fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 },
  spinner: { width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'block', animation: 'spin 0.7s linear infinite' },
}