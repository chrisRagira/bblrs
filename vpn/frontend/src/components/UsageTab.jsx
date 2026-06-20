import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '../lib/api.js'

// FIX #4: explicit number check instead of falsy guard
function fmt(bytes) {
  if (typeof bytes !== 'number' || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={s.tooltip}>
      <p style={s.tooltipDate}>{label}</p>
      <p style={s.tooltipVal}>{fmt(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

export default function UsageTab() {
  const [usage, setUsage]     = useState(null)
  const [history, setHistory] = useState([])
  const [err, setErr]         = useState('')

  // FIX #3: cancel flag prevents setState on unmounted component
  useEffect(() => {
    let cancelled = false

    Promise.all([api.usage(), api.history()])
      .then(([u, h]) => {
        if (cancelled) return
        setUsage(u)
        const daily = (u.daily ?? []).map(d => ({
          date:  new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
          bytes: Number(d.bytes ?? 0),
        })).reverse()
        setHistory(daily)
      })
      .catch(e => { if (!cancelled) setErr(e.message) })

    return () => { cancelled = true }
  }, [])

  if (err)    return <div style={s.err}>{err}</div>
  if (!usage) return <div style={s.loading}><span style={s.spinner} /></div>

  // FIX #6: single derived value used consistently throughout
  const bwPct = Math.min(usage.bandwidth_pct ?? 0, 100)

  return (
    <div>
      <div style={s.header} className="fade-up">
        <h2 style={s.title}>Usage</h2>
        <span style={s.period}>{usage.period}</span>
      </div>

      {/* Month summary */}
      <div style={s.summaryGrid} className="fade-up-2">
        {[
          { label: 'Bandwidth', value: fmt(usage.bytes_used), limit: usage.bytes_limit ? `/ ${fmt(usage.bytes_limit)}` : '/ ∞' },
          { label: 'Plan',      value: usage.plan, limit: '' },
        ].map(({ label, value, limit }) => (
          <div key={label} style={s.sumCard}>
            <span style={s.sumLabel}>{label}</span>
            <div style={s.sumBottom}>
              <span style={s.sumVal}>{value}</span>
              {limit && <span style={s.sumLimit}>{limit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={s.chartCard} className="fade-up-3">
        <h3 style={s.chartTitle}>Daily bandwidth — last 30 days</h3>
        {history.length === 0
          ? <p style={s.noData}>No traffic yet. Start using the proxy to see data here.</p>
          : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={history} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" tick={{ fill: '#6b6b80', fontSize: 11, fontFamily: 'DM Mono' }}
                  axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#6b6b80', fontSize: 11, fontFamily: 'DM Mono' }}
                  axisLine={false} tickLine={false} width={56} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,109,250,0.06)' }} />
                <Bar dataKey="bytes" radius={[3, 3, 0, 0]} maxBarSize={32}>
                  {/* FIX #1: use entry.date as key; FIX #2: index 0 is most recent after .reverse() */}
                  {history.map((entry, i) => (
                    <Cell key={entry.date} fill={i === 0 ? '#7c6dfa' : '#2a2a38'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )
        }
      </div>

      {/* Plan limits */}
      {usage.bytes_limit && (
        <div style={s.limitCard} className="fade-up-4">
          <h3 style={s.chartTitle}>Bandwidth limit</h3>
          <div style={s.limitBar}>
            <div style={{
              ...s.limitFill,
              width: `${bwPct}%`,
              background: bwPct > 90 ? 'var(--danger)'
                : bwPct > 70 ? 'var(--warning)'
                : 'var(--accent)',
            }} />
          </div>
          <div style={s.limitLabels}>
            <span style={s.limitLabel}>{fmt(usage.bytes_used)} used</span>
            <span style={s.limitLabel}>{bwPct}%</span>
            <span style={s.limitLabel}>{fmt(usage.bytes_limit)} total</span>
          </div>
          {bwPct > 80 && (
            <div style={s.warning}>
              ⚠ You've used {bwPct}% of your monthly bandwidth. Consider upgrading your plan.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  header:      { display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 28 },
  title:       { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em' },
  period:      { fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)', background: 'var(--bg3)', padding: '3px 10px', borderRadius: 20 },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 },
  sumCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
  },
  sumLabel:  { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' },
  sumBottom: { display: 'flex', alignItems: 'baseline', gap: 6 },
  sumVal:    { fontFamily: 'var(--font-head)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', textTransform: 'capitalize' },
  sumLimit:  { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' },
  chartCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    padding: '22px 24px', marginBottom: 20,
  },
  chartTitle: { fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 14, marginBottom: 20 },
  noData:     { color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: '40px 0' },
  tooltip: {
    background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)',
    padding: '10px 14px',
  },
  tooltipDate: { fontSize: 11, color: 'var(--muted)', marginBottom: 4 },
  tooltipVal:  { fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--accent2)', fontWeight: 500 },
  limitCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    padding: '22px 24px',
  },
  limitBar:    { height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  limitFill:   { height: '100%', borderRadius: 4, transition: 'width 0.8s ease' },
  limitLabels: { display: 'flex', justifyContent: 'space-between' },
  limitLabel:  { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' },
  warning: {
    marginTop: 14, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
    color: 'var(--warning)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13,
  },
  loading:  { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 },
  spinner:  { width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'block', animation: 'spin 0.7s linear infinite' },
  err:      { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--danger)', borderRadius: 'var(--radius)', padding: '14px 18px', fontSize: 14 },
}