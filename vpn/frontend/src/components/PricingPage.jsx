import { useState } from 'react'
import { getUser } from '../lib/api.js'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    bandwidth: '5 GB',
    rpm: 10,
    keys: 1,
    features: ['HTTP & HTTPS proxy', '1 API key', 'Basic usage stats', 'Community support'],
    cta: 'Get started',
    highlight: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 9,
    bandwidth: '50 GB',
    rpm: 60,
    keys: 3,
    features: ['HTTP & HTTPS proxy', '3 API keys', 'Full usage dashboard', 'Daily bandwidth charts', 'Email support'],
    cta: 'Upgrade to Starter',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    bandwidth: '200 GB',
    rpm: 200,
    keys: 10,
    features: ['HTTP & HTTPS proxy', '10 API keys', 'Full usage dashboard', 'Daily bandwidth charts', 'Priority support', 'Higher rate limits'],
    cta: 'Upgrade to Pro',
    highlight: true,
    tag: 'Most popular',
  },
  {
    id: 'business',
    name: 'Business',
    price: 99,
    bandwidth: 'Unlimited',
    rpm: 600,
    keys: 50,
    features: ['HTTP & HTTPS proxy', '50 API keys', 'Full usage dashboard', 'Daily bandwidth charts', 'Dedicated support', 'Custom rate limits', 'SLA guarantee'],
    cta: 'Upgrade to Business',
    highlight: false,
  },
]

const COMPARE = [
  { label: 'Monthly bandwidth',  vals: ['5 GB', '50 GB', '200 GB', 'Unlimited'] },
  // { label: 'Rate limit',         vals: ['10 req/min', '60 req/min', '200 req/min', '600 req/min'] },
  { label: 'API keys',           vals: ['1', '3', '10', '50'] },
  { label: 'Usage dashboard',    vals: [true, true, true, true] },
  { label: 'Daily charts',       vals: [false, true, true, true] },
  { label: 'Email support',      vals: [false, true, true, true] },
  { label: 'Priority support',   vals: [false, false, true, true] },
  { label: 'Dedicated support',  vals: [false, false, false, true] },
  { label: 'SLA guarantee',      vals: [false, false, false, true] },
]

function Check({ val }) {
  if (val === true)  return <span style={{ color: 'var(--success)', fontSize: 16 }}>✓</span>
  if (val === false) return <span style={{ color: 'var(--border2)', fontSize: 14 }}>—</span>
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{val}</span>
}

export default function PricingPage({ onSelectPlan }) {
  const [billing, setBilling] = useState('monthly') // monthly | annual
  const user = getUser()

  function discount(price) {
    if (billing === 'annual') return Math.round(price * 0.8)
    return price
  }

  return (
    <div>
      <div style={s.header} className="fade-up">
        <h2 style={s.title}>Pricing</h2>
        <p style={s.sub}>Simple, transparent pricing. No hidden fees. Cancel any time.</p>

        {/* Billing toggle */}
        <div style={s.billingToggle}>
          <button style={{ ...s.toggleBtn, ...(billing === 'monthly' ? s.toggleActive : {}) }}
            onClick={() => setBilling('monthly')}>Monthly</button>
          <button style={{ ...s.toggleBtn, ...(billing === 'annual' ? s.toggleActive : {}) }}
            onClick={() => setBilling('annual')}>
            Annual
            <span style={s.saveBadge}>Save 20%</span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div style={s.planGrid} className="fade-up-2">
        {PLANS.map((plan, i) => {
          const isCurrent = user?.plan === plan.id
          const price = discount(plan.price)
          return (
            <div key={plan.id} style={{ ...s.planCard, ...(plan.highlight ? s.planHighlight : {}) }}
              className={`fade-up`} style={{ animationDelay: `${i * 0.07}s`, ...(plan.highlight ? { ...s.planCard, ...s.planHighlight } : s.planCard) }}>

              {plan.tag && <div style={s.planTag}>{plan.tag}</div>}

              <div style={s.planHead}>
                <span style={s.planName}>{plan.name}</span>
                <div style={s.priceRow}>
                  <span style={s.price}>${price}</span>
                  <span style={s.per}>/mo</span>
                </div>
                {billing === 'annual' && plan.price > 0 && (
                  <span style={s.annualNote}>billed ${price * 12}/year</span>
                )}
              </div>

              <div style={s.divider} />

              <div style={s.specs}>
                {[
                  ['Bandwidth', plan.bandwidth],
                  // ['Rate limit', `${plan.rpm} req/min`],
                  ['API keys',  `${plan.keys} key${plan.keys > 1 ? 's' : ''}`],
                ].map(([k, v]) => (
                  <div key={k} style={s.specRow}>
                    <span style={s.specKey}>{k}</span>
                    <span style={s.specVal}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={s.divider} />

              <ul style={s.featureList}>
                {plan.features.map(f => (
                  <li key={f} style={s.feature}>
                    <span style={s.featureCheck}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                style={{
                  ...s.ctaBtn,
                  ...(plan.highlight ? s.ctaBtnHighlight : {}),
                  ...(isCurrent ? s.ctaBtnCurrent : {}),
                }}
                disabled={isCurrent}
                onClick={() => onSelectPlan?.(plan.id)}
              >
                {isCurrent ? '✓ Current plan' : plan.cta}
              </button>
            </div>
          )
        })}
      </div>

      {/* Comparison table */}
      <div style={s.compareSection} className="fade-up-4">
        <h3 style={s.compareTitle}>Full comparison</h3>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, textAlign: 'left', width: '40%' }}>Feature</th>
                {PLANS.map(p => (
                  <th key={p.id} style={{ ...s.th, ...(p.highlight ? { color: 'var(--accent2)' } : {}) }}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row, i) => (
                <tr key={row.label} style={{ ...s.tr, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={{ ...s.td, color: 'var(--muted)', fontSize: 13 }}>{row.label}</td>
                  {row.vals.map((v, j) => (
                    <td key={j} style={{ ...s.td, textAlign: 'center' }}>
                      <Check val={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div style={s.faq} className="fade-up-4">
        <h3 style={s.faqTitle}>FAQ</h3>
        <div style={s.faqGrid}>
          {[
            {
              q: 'What happens when I hit my bandwidth limit?',
              a: 'Your proxy access is paused until the 1st of next month. You can upgrade at any time to immediately restore access.',
            },
            {
              q: 'Can I change plans?',
              a: 'Yes, upgrades take effect immediately. Downgrades take effect at the start of the next billing cycle.',
            },
            {
              q: 'What protocols are supported?',
              a: 'HTTP and HTTPS (via CONNECT tunneling). SOCKS5 is not currently supported.',
            },
            {
              q: 'Is my traffic logged?',
              a: 'We log bandwidth totals and request counts per key for billing. We do not log the content of your requests.',
            },
          ].map(({ q, a }) => (
            <div key={q} style={s.faqCard}>
              <p style={s.faqQ}>{q}</p>
              <p style={s.faqA}>{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const s = {
  header: { marginBottom: 36, textAlign: 'center' },
  title: { fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 32, letterSpacing: '-0.03em', marginBottom: 8 },
  sub: { color: 'var(--muted)', fontSize: 15, marginBottom: 24 },
  billingToggle: { display: 'inline-flex', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' },
  toggleBtn: {
    background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'var(--font-body)',
    fontSize: 14, padding: '8px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
    transition: 'all 0.15s',
  },
  toggleActive: { background: 'var(--bg3)', color: 'var(--text)', fontWeight: 500 },
  saveBadge: {
    background: 'rgba(52,211,153,0.15)', color: 'var(--success)',
    borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600,
  },
  planGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16, marginBottom: 48 },
  planCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 0, position: 'relative',
  },
  planHighlight: {
    border: '1px solid var(--accent)', background: 'rgba(124,109,250,0.04)',
    boxShadow: '0 0 0 1px rgba(124,109,250,0.2)',
  },
  planTag: {
    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
    background: 'var(--accent)', color: '#fff', borderRadius: 20,
    padding: '3px 12px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.04em',
  },
  planHead: { marginBottom: 16 },
  planName: { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16, display: 'block', marginBottom: 10 },
  priceRow: { display: 'flex', alignItems: 'baseline', gap: 3 },
  price: { fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 36, letterSpacing: '-0.03em' },
  per: { fontSize: 14, color: 'var(--muted)' },
  annualNote: { fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 4 },
  divider: { height: 1, background: 'var(--border)', margin: '16px 0' },
  specs: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 0 },
  specRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  specKey: { fontSize: 12, color: 'var(--muted)' },
  specVal: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' },
  featureList: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, marginBottom: 20 },
  feature: { fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 },
  featureCheck: { color: 'var(--success)', fontSize: 12, flexShrink: 0 },
  ctaBtn: {
    background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)',
    borderRadius: 'var(--radius)', fontFamily: 'var(--font-head)', fontWeight: 700,
    fontSize: 14, padding: '11px 0', cursor: 'pointer', width: '100%',
    transition: 'all 0.15s', marginTop: 'auto',
  },
  ctaBtnHighlight: { background: 'var(--accent)', border: '1px solid var(--accent)', color: '#fff' },
  ctaBtnCurrent: { background: 'var(--bg3)', color: 'var(--success)', borderColor: 'rgba(52,211,153,0.3)', cursor: 'default' },
  compareSection: { marginBottom: 48 },
  compareTitle: { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', marginBottom: 20 },
  tableWrap: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', textAlign: 'center', fontFamily: 'var(--font-head)' },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '11px 16px', fontSize: 14 },
  faq: { marginBottom: 40 },
  faqTitle: { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', marginBottom: 20 },
  faqGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 },
  faqCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 22px' },
  faqQ: { fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 14, marginBottom: 8, lineHeight: 1.4 },
  faqA: { color: 'var(--muted)', fontSize: 13, lineHeight: 1.7 },
}