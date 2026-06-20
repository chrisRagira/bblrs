import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api.js'

const PLANS = [
  { id: 'free',     name: 'Free',     price: 0,  bandwidth: '5 GB',       keys: 1  },
  { id: 'starter',  name: 'Starter',  price: 9,  bandwidth: '50 GB',      keys: 3  },
  { id: 'pro',      name: 'Pro',      price: 29, bandwidth: '200 GB',     keys: 10 },
  { id: 'business', name: 'Business', price: 99, bandwidth: 'Unlimited',  keys: 50 },
]

const METHODS = [
  { id: 'mpesa',   label: 'M-Pesa',     icon: MpesaIcon  },
  { id: 'stripe',  label: 'Card',       icon: CardIcon   },
  { id: 'paypal',  label: 'PayPal',     icon: PaypalIcon },
]

// ── Icons ─────────────────────────────────────────────────────────────────────

function MpesaIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill="#00A550"/>
      <text x="14" y="19" textAnchor="middle" fill="white" fontSize="9" fontWeight="800" fontFamily="monospace">M-PESA</text>
    </svg>
  )
}
function CardIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill="#1a1a2e"/>
      <rect x="4" y="8" width="20" height="13" rx="2" stroke="#7c6dfa" strokeWidth="1.5"/>
      <rect x="4" y="12" width="20" height="3" fill="#7c6dfa" opacity="0.5"/>
      <rect x="6" y="17" width="6" height="2" rx="1" fill="#7c6dfa"/>
    </svg>
  )
}
function PaypalIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill="#003087"/>
      <text x="14" y="19" textAnchor="middle" fill="#009cde" fontSize="11" fontWeight="800" fontFamily="serif">PP</text>
    </svg>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function PlanSelector({ selectedPlan, onChange, currentPlan }) {
  return (
    <div style={s.planGrid}>
      {PLANS.filter(p => p.price > 0).map(plan => {
        const isCurrent = plan.id === currentPlan
        const isSelected = plan.id === selectedPlan
        return (
          <button
            key={plan.id}
            onClick={() => !isCurrent && onChange(plan.id)}
            style={{
              ...s.planCard,
              ...(isSelected ? s.planCardSelected : {}),
              ...(isCurrent ? s.planCardCurrent : {}),
            }}
          >
            {isCurrent && <span style={s.currentBadge}>Current</span>}
            <span style={s.planName}>{plan.name}</span>
            <span style={s.planPrice}>${plan.price}<span style={s.planPer}>/mo</span></span>
            <span style={s.planBw}>{plan.bandwidth}</span>
            <span style={s.planKeys}>{plan.keys} key{plan.keys > 1 ? 's' : ''}</span>
          </button>
        )
      })}
    </div>
  )
}

function MethodSelector({ selected, onChange }) {
  return (
    <div style={s.methodRow}>
      {METHODS.map(m => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          style={{ ...s.methodBtn, ...(selected === m.id ? s.methodBtnActive : {}) }}
        >
          <m.icon />
          <span style={s.methodLabel}>{m.label}</span>
          {selected === m.id && <span style={s.methodCheck}>✓</span>}
        </button>
      ))}
    </div>
  )
}

// ── M-Pesa form ───────────────────────────────────────────────────────────────

function MpesaForm({ plan, billing, onSuccess, onError }) {
  const [phone, setPhone]   = useState('')
  const [status, setStatus] = useState('idle') // idle | pending | polling | success | error
  const [msg, setMsg]       = useState('')
  const pollRef             = useRef(null)

  async function submit() {
    // Normalise phone: 07XXXXXXXX → 2547XXXXXXXX
    const raw = phone.replace(/\s/g, '')
    const normalised = raw.startsWith('0')
      ? '254' + raw.slice(1)
      : raw.startsWith('+')
      ? raw.slice(1)
      : raw

    if (!/^2547\d{8}$/.test(normalised)) {
      setMsg('Enter a valid Safaricom number (07XXXXXXXX)')
      return
    }

    setStatus('pending')
    setMsg('Sending STK push…')

    try {
      const res = await api.post('/billing/mpesa/initiate', {
        phone: normalised,
        plan_id: plan,
        billing_cycle: billing,
      })
      setStatus('polling')
      setMsg('Check your phone and enter your M-Pesa PIN')
      pollCheckout(res.checkout_request_id)
    } catch (e) {
      setStatus('error')
      setMsg(e.message || 'Failed to initiate payment')
      onError(e.message)
    }
  }

  function pollCheckout(checkoutId) {
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      if (attempts > 24) { // 2 min max
        clearInterval(pollRef.current)
        setStatus('error')
        setMsg('Payment timed out. Please try again.')
        return
      }
      try {
        const res = await api.post('/billing/mpesa/status', { checkout_request_id: checkoutId })
        if (res.status === 'success') {
          clearInterval(pollRef.current)
          setStatus('success')
          setMsg('Payment confirmed! Activating your plan…')
          onSuccess()
        } else if (res.status === 'failed') {
          clearInterval(pollRef.current)
          setStatus('error')
          setMsg(res.message || 'Payment failed or was cancelled.')
        }
        // 'pending' → keep polling
      } catch { /* keep polling */ }
    }, 5000)
  }

  useEffect(() => () => clearInterval(pollRef.current), [])

  return (
    <div style={s.payForm}>
      <label style={s.label}>Safaricom phone number</label>
      <div style={s.inputRow}>
        <span style={s.inputPrefix}>🇰🇪 +254</span>
        <input
          style={s.input}
          placeholder="7XX XXX XXX"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          disabled={status === 'pending' || status === 'polling' || status === 'success'}
          maxLength={12}
        />
      </div>

      {msg && (
        <div style={{ ...s.statusMsg, ...(status === 'error' ? s.statusError : status === 'success' ? s.statusSuccess : s.statusInfo) }}>
          {status === 'polling' && <span style={s.pulse}>●</span>}
          {msg}
        </div>
      )}

      {(status === 'idle' || status === 'error') && (
        <button style={s.payBtn} onClick={submit}>
          Send STK Push
        </button>
      )}
      {(status === 'pending' || status === 'polling') && (
        <button style={{ ...s.payBtn, ...s.payBtnDisabled }} disabled>
          <span style={s.spinner} /> Waiting for payment…
        </button>
      )}
    </div>
  )
}

// ── Stripe form ───────────────────────────────────────────────────────────────

function StripeForm({ plan, billing, onSuccess, onError }) {
  const [status, setStatus] = useState('idle')

  async function startCheckout() {
    setStatus('loading')
    try {
      const res = await api.post('/billing/stripe/checkout', {
        plan_id: plan,
        billing_cycle: billing,
      })
      // Redirect to Stripe Checkout — returns to /billing?session_id=...
      window.location.href = res.url
    } catch (e) {
      setStatus('error')
      onError(e.message)
    }
  }

  return (
    <div style={s.payForm}>
      <p style={s.stripeNote}>
        You'll be redirected to Stripe's secure checkout to enter your card details.
        Supports Visa, Mastercard, and American Express.
      </p>
      <div style={s.cardLogos}>
        {['VISA', 'MC', 'AMEX'].map(c => (
          <span key={c} style={s.cardLogo}>{c}</span>
        ))}
      </div>
      <button
        style={{ ...s.payBtn, ...(status === 'loading' ? s.payBtnDisabled : {}) }}
        onClick={startCheckout}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? <><span style={s.spinner} /> Redirecting…</> : 'Pay with Card'}
      </button>
    </div>
  )
}

// ── PayPal form ───────────────────────────────────────────────────────────────

function PayPalForm({ plan, billing, onSuccess, onError }) {
  const [status, setStatus] = useState('idle')

  async function startCheckout() {
    setStatus('loading')
    try {
      const res = await api.post('/billing/paypal/checkout', {
        plan_id: plan,
        billing_cycle: billing,
      })
      window.location.href = res.url
    } catch (e) {
      setStatus('error')
      onError(e.message)
    }
  }

  return (
    <div style={s.payForm}>
      <p style={s.stripeNote}>
        You'll be redirected to PayPal to complete your payment securely.
      </p>
      <button
        style={{ ...s.payBtn, ...s.payBtnPaypal, ...(status === 'loading' ? s.payBtnDisabled : {}) }}
        onClick={startCheckout}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? <><span style={s.spinner} /> Redirecting…</> : 'Pay with PayPal'}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState('free')
  const [selectedPlan, setSelectedPlan] = useState('starter')
  const [billing, setBilling]           = useState('monthly')
  const [method, setMethod]             = useState('mpesa')
  const [toast, setToast]               = useState(null)   // { msg, type }
  const [upgraded, setUpgraded]         = useState(false)

  // Load current plan on mount
  useEffect(() => {
    api.get('/usage').then(u => {
      const id = u.plan?.toLowerCase()
      setCurrentPlan(id)
      // Default selection to next tier up
      const idx = PLANS.findIndex(p => p.id === id)
      if (idx >= 0 && idx < PLANS.length - 1) setSelectedPlan(PLANS[idx + 1].id)
    }).catch(() => {})

    // Handle Stripe/PayPal redirect back with session param
    const params = new URLSearchParams(window.location.search)
    const session = params.get('session_id') || params.get('token')
    if (session) verifyRedirectPayment(session)
  }, [])

  async function verifyRedirectPayment(session) {
    try {
      await api.post('/billing/verify', { session })
      handleSuccess()
    } catch (e) {
      showToast(e.message || 'Payment verification failed', 'error')
    }
    // Clean URL
    window.history.replaceState({}, '', '/billing')
  }

  function handleSuccess() {
    setUpgraded(true)
    showToast('Plan upgraded successfully! Changes are live.', 'success')
    // Refresh current plan label
    api.get('/usage').then(u => setCurrentPlan(u.plan?.toLowerCase())).catch(() => {})
  }

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  const plan = PLANS.find(p => p.id === selectedPlan)
  const price = billing === 'annual' ? Math.round(plan.price * 0.8) : plan.price

  if (upgraded) {
    return (
      <div style={s.successPage} className="fade-up">
        <div style={s.successIcon}>✓</div>
        <h2 style={s.successTitle}>You're on {plan?.name}!</h2>
        <p style={s.successSub}>Your plan is active. New bandwidth limit and API key quota apply immediately.</p>
        <button style={s.payBtn} onClick={() => { setUpgraded(false) }}>
          Back to billing
        </button>
      </div>
    )
  }

  return (
    <div style={s.page}>
      {toast && (
        <div style={{ ...s.toast, ...(toast.type === 'error' ? s.toastError : s.toastSuccess) }}>
          {toast.msg}
        </div>
      )}

      <div style={s.header} className="fade-up">
        <h2 style={s.title}>Billing</h2>
        <p style={s.sub}>
          Current plan: <strong style={{ color: 'var(--text)' }}>
            {PLANS.find(p => p.id === currentPlan)?.name ?? currentPlan}
          </strong>
        </p>
      </div>

      <div style={s.layout}>
        {/* Left — plan + method selection */}
        <div style={s.leftCol}>
          {/* Billing cycle toggle */}
          <section style={s.section} className="fade-up-2">
            <h3 style={s.sectionTitle}>Billing cycle</h3>
            <div style={s.cycleRow}>
              {['monthly', 'annual'].map(c => (
                <button
                  key={c}
                  style={{ ...s.cycleBtn, ...(billing === c ? s.cycleBtnActive : {}) }}
                  onClick={() => setBilling(c)}
                >
                  {c === 'monthly' ? 'Monthly' : 'Annual'}
                  {c === 'annual' && <span style={s.saveBadge}>–20%</span>}
                </button>
              ))}
            </div>
          </section>

          {/* Plan selection */}
          <section style={s.section} className="fade-up-2">
            <h3 style={s.sectionTitle}>Select plan</h3>
            <PlanSelector
              selectedPlan={selectedPlan}
              onChange={setSelectedPlan}
              currentPlan={currentPlan}
            />
          </section>

          {/* Payment method */}
          <section style={s.section} className="fade-up-3">
            <h3 style={s.sectionTitle}>Payment method</h3>
            <MethodSelector selected={method} onChange={setMethod} />
          </section>
        </div>

        {/* Right — order summary + payment form */}
        <div style={s.rightCol} className="fade-up-3">
          <div style={s.summaryCard}>
            <h3 style={s.summaryTitle}>Order summary</h3>
            <div style={s.summaryRow}>
              <span style={s.summaryLabel}>{plan.name} plan</span>
              <span style={s.summaryVal}>${price}/mo</span>
            </div>
            <div style={s.summaryRow}>
              <span style={s.summaryLabel}>Bandwidth</span>
              <span style={s.summaryVal}>{plan.bandwidth}</span>
            </div>
            <div style={s.summaryRow}>
              <span style={s.summaryLabel}>API keys</span>
              <span style={s.summaryVal}>{plan.keys}</span>
            </div>
            {billing === 'annual' && (
              <div style={s.summaryRow}>
                <span style={s.summaryLabel}>Billed annually</span>
                <span style={{ ...s.summaryVal, color: 'var(--success)' }}>${price * 12}/yr</span>
              </div>
            )}
            <div style={s.summaryDivider} />
            <div style={s.summaryTotal}>
              <span>Total today</span>
              <span style={s.summaryTotalAmt}>${billing === 'annual' ? price * 12 : price}</span>
            </div>

            <div style={s.summaryDivider} />

            {method === 'mpesa'  && <MpesaForm  plan={selectedPlan} billing={billing} onSuccess={handleSuccess} onError={msg => showToast(msg, 'error')} />}
            {method === 'stripe' && <StripeForm  plan={selectedPlan} billing={billing} onSuccess={handleSuccess} onError={msg => showToast(msg, 'error')} />}
            {method === 'paypal' && <PayPalForm  plan={selectedPlan} billing={billing} onSuccess={handleSuccess} onError={msg => showToast(msg, 'error')} />}
          </div>

          <p style={s.secureNote}>🔒 Payments are processed securely. We never store card details.</p>
        </div>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page:    { maxWidth: 900, margin: '0 auto' },
  header:  { marginBottom: 32 },
  title:   { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', marginBottom: 4 },
  sub:     { color: 'var(--muted)', fontSize: 14 },
  layout:  { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 24 },
  rightCol:{ display: 'flex', flexDirection: 'column', gap: 12 },

  section:      { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 22px' },
  sectionTitle: { fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 },

  cycleRow:       { display: 'flex', gap: 8 },
  cycleBtn:       { flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--muted)', fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 13, padding: '9px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s' },
  cycleBtnActive: { background: 'var(--bg3)', border: '1px solid var(--accent)', color: 'var(--text)' },
  saveBadge:      { background: 'rgba(52,211,153,0.15)', color: 'var(--success)', borderRadius: 20, padding: '2px 7px', fontSize: 10, fontWeight: 700 },

  planGrid:         { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 },
  planCard:         { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left', transition: 'all 0.15s', position: 'relative' },
  planCardSelected: { border: '1px solid var(--accent)', background: 'rgba(124,109,250,0.06)' },
  planCardCurrent:  { opacity: 0.5, cursor: 'default' },
  currentBadge:     { position: 'absolute', top: 6, right: 6, background: 'rgba(52,211,153,0.15)', color: 'var(--success)', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10, letterSpacing: '0.05em' },
  planName:         { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 13 },
  planPrice:        { fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', marginTop: 2 },
  planPer:          { fontSize: 11, fontWeight: 400, color: 'var(--muted)' },
  planBw:           { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 4 },
  planKeys:         { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' },

  methodRow:       { display: 'flex', gap: 10 },
  methodBtn:       { flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.15s', position: 'relative' },
  methodBtnActive: { border: '1px solid var(--accent)', background: 'rgba(124,109,250,0.06)' },
  methodLabel:     { fontSize: 12, fontFamily: 'var(--font-head)', fontWeight: 600, color: 'var(--muted)' },
  methodCheck:     { position: 'absolute', top: 6, right: 6, color: 'var(--accent)', fontSize: 11, fontWeight: 700 },

  summaryCard:    { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '22px 22px' },
  summaryTitle:   { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 15, marginBottom: 16 },
  summaryRow:     { display: 'flex', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel:   { fontSize: 13, color: 'var(--muted)' },
  summaryVal:     { fontFamily: 'var(--font-mono)', fontSize: 13 },
  summaryDivider: { height: 1, background: 'var(--border)', margin: '14px 0' },
  summaryTotal:   { display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 15 },
  summaryTotalAmt:{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--accent2)' },

  payForm:    { display: 'flex', flexDirection: 'column', gap: 12 },
  label:      { fontSize: 12, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.04em' },
  inputRow:   { display: 'flex', alignItems: 'center', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' },
  inputPrefix:{ padding: '0 10px', fontSize: 13, color: 'var(--muted)', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' },
  input:      { flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 14, padding: '10px 12px' },

  statusMsg:    { fontSize: 13, padding: '10px 12px', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 8 },
  statusInfo:   { background: 'rgba(124,109,250,0.08)', border: '1px solid rgba(124,109,250,0.2)', color: 'var(--accent2)' },
  statusError:  { background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--danger)' },
  statusSuccess:{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: 'var(--success)' },
  pulse:        { animation: 'pulse 1s ease-in-out infinite', display: 'inline-block' },

  payBtn:        { background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 'var(--radius)', fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 14, padding: '12px 0', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity 0.15s' },
  payBtnDisabled:{ opacity: 0.6, cursor: 'not-allowed' },
  payBtnPaypal:  { background: '#003087' },

  stripeNote: { fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 },
  cardLogos:  { display: 'flex', gap: 6 },
  cardLogo:   { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.05em' },

  spinner: { width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' },

  secureNote: { fontSize: 12, color: 'var(--muted)', textAlign: 'center' },

  toast:        { position: 'fixed', top: 20, right: 20, zIndex: 999, padding: '12px 18px', borderRadius: 'var(--radius)', fontSize: 14, fontFamily: 'var(--font-head)', fontWeight: 600, maxWidth: 340, animation: 'fadeIn 0.2s ease' },
  toastSuccess: { background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: 'var(--success)' },
  toastError:   { background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--danger)' },

  successPage:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16, textAlign: 'center' },
  successIcon:  { width: 64, height: 64, borderRadius: '50%', background: 'rgba(52,211,153,0.15)', border: '2px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'var(--success)' },
  successTitle: { fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em' },
  successSub:   { color: 'var(--muted)', fontSize: 14, maxWidth: 380, lineHeight: 1.7 },
}