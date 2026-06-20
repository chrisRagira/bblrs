/**
 * routes/billing.js
 *
 * POST /api/billing/mpesa/initiate   — fire STK push
 * POST /api/billing/mpesa/status     — poll checkout status
 * POST /api/billing/stripe/checkout  — create Stripe Checkout session
 * POST /api/billing/paypal/checkout  — create PayPal order
 * POST /api/billing/verify           — verify Stripe/PayPal redirect-back session
 *
 * Webhooks (no auth, raw body needed — mount separately in server.js):
 *   POST /webhooks/stripe
 *   POST /webhooks/mpesa
 *   POST /webhooks/paypal
 */

import { Router }  from 'express'
import Stripe      from 'stripe'
import { db }      from '../server.js'
import { requireAuth } from './auth.js'

const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getPlan(planId) {
  const result = await db.query('SELECT * FROM plans WHERE id = $1', [planId])
  return result.rows[0] ?? null
}

async function upgradePlan(userId, planId, paymentRef) {
  await db.query(
    `UPDATE users SET plan_id = (SELECT id FROM plans WHERE name ILIKE $2) WHERE id = $1`,
    [userId, planId]
  )
  await db.query(
    `INSERT INTO billing_events (user_id, plan_id, payment_ref, provider, status)
     VALUES ($1, $2, $3, $4, 'success')`,
    [userId, planId, paymentRef.ref, paymentRef.provider]
  )
}

function planPrice(plan, cycle) {
  // price_monthly / price_annual stored as cents in DB
  return cycle === 'annual'
    ? Math.round(plan.price_monthly * 0.8 * 12)
    : plan.price_monthly
}

// ── All routes below require user auth ────────────────────────────────────────

router.use(requireAuth)

// ── M-Pesa STK Push ───────────────────────────────────────────────────────────

router.post('/mpesa/initiate', async (req, res) => {
  const { phone, plan_id, billing_cycle = 'monthly' } = req.body
  if (!phone || !plan_id) return res.status(400).json({ error: 'phone and plan_id required' })

  const plan = await getPlan(plan_id)
  if (!plan) return res.status(400).json({ error: 'Invalid plan' })

  const amountKes = planPrice(plan, billing_cycle)  // must be KES in your plans table

  // Get M-Pesa access token
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64')

  const tokenRes = await fetch(
    'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  )
  if (!tokenRes.ok) return res.status(502).json({ error: 'M-Pesa auth failed' })
  const { access_token } = await tokenRes.json()

  // Build STK push payload
  const shortcode  = process.env.MPESA_SHORTCODE
  const passkey    = process.env.MPESA_PASSKEY
  const timestamp  = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  const password   = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64')

  const stkRes = await fetch(
    'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password:          password,
        Timestamp:         timestamp,
        TransactionType:   'CustomerPayBillOnline',
        Amount:            amountKes,
        PartyA:            phone,
        PartyB:            shortcode,
        PhoneNumber:       phone,
        CallBackURL:       `${process.env.APP_URL}/webhooks/mpesa`,
        AccountReference:  `ProxyAaS-${plan_id}`,
        TransactionDesc:   `${plan.name} plan - ${billing_cycle}`,
      }),
    }
  )

  const stk = await stkRes.json()
  if (stk.ResponseCode !== '0') {
    return res.status(502).json({ error: stk.ResponseDescription || 'STK push failed' })
  }

  // Persist pending payment so the webhook can match it
  await db.query(
    `INSERT INTO pending_payments
       (user_id, plan_id, billing_cycle, provider, provider_ref, amount, status)
     VALUES ($1, $2, $3, 'mpesa', $4, $5, 'pending')`,
    [req.user.id, plan_id, billing_cycle, stk.CheckoutRequestID, amountKes]
  )

  res.json({ checkout_request_id: stk.CheckoutRequestID })
})

// Poll: frontend asks every 5 s while waiting for the webhook to update the row
router.post('/mpesa/status', async (req, res) => {
  const { checkout_request_id } = req.body
  if (!checkout_request_id) return res.status(400).json({ error: 'checkout_request_id required' })

  const result = await db.query(
    `SELECT status, failure_reason FROM pending_payments
     WHERE provider_ref = $1 AND user_id = $2`,
    [checkout_request_id, req.user.id]
  )

  if (!result.rows.length) return res.status(404).json({ error: 'Payment not found' })

  const { status, failure_reason } = result.rows[0]
  res.json({ status, message: failure_reason ?? null })
})

// ── Stripe Checkout ───────────────────────────────────────────────────────────

router.post('/stripe/checkout', async (req, res) => {
  const { plan_id, billing_cycle = 'monthly' } = req.body
  if (!plan_id) return res.status(400).json({ error: 'plan_id required' })

  const plan = await getPlan(plan_id)
  if (!plan) return res.status(400).json({ error: 'Invalid plan' })

  // Map plan + cycle to a Stripe Price ID stored in your plans table
  const priceId = billing_cycle === 'annual' ? plan.stripe_price_annual : plan.stripe_price_monthly
  if (!priceId) return res.status(400).json({ error: 'No Stripe price configured for this plan' })

  const session = await stripe.checkout.sessions.create({
    mode:               'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.APP_URL}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${process.env.APP_URL}/billing`,
    client_reference_id: String(req.user.id),
    metadata: { plan_id, billing_cycle },
  })

  res.json({ url: session.url })
})

// ── PayPal Order ──────────────────────────────────────────────────────────────

async function getPayPalToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64')
  const res = await fetch(`${process.env.PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  return data.access_token
}

router.post('/paypal/checkout', async (req, res) => {
  const { plan_id, billing_cycle = 'monthly' } = req.body
  if (!plan_id) return res.status(400).json({ error: 'plan_id required' })

  const plan = await getPlan(plan_id)
  if (!plan) return res.status(400).json({ error: 'Invalid plan' })

  const amountUsd = planPrice(plan, billing_cycle)
  const token     = await getPayPalToken()

  const orderRes = await fetch(`${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount:      { currency_code: 'USD', value: String(amountUsd) },
        description: `${plan.name} plan - ${billing_cycle}`,
        custom_id:   `${req.user.id}:${plan_id}:${billing_cycle}`,
      }],
      application_context: {
        return_url: `${process.env.APP_URL}/billing?token={token}`,
        cancel_url: `${process.env.APP_URL}/billing`,
      },
    }),
  })

  const order = await orderRes.json()
  if (order.status !== 'CREATED') {
    return res.status(502).json({ error: 'PayPal order creation failed' })
  }

  const approveLink = order.links.find(l => l.rel === 'approve')
  res.json({ url: approveLink.href })
})

// ── Verify redirect-back (Stripe session_id or PayPal token) ─────────────────

router.post('/verify', async (req, res) => {
  const { session } = req.body
  if (!session) return res.status(400).json({ error: 'session required' })

  // Try Stripe first
  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(session)
    if (checkoutSession.payment_status === 'paid' &&
        String(checkoutSession.client_reference_id) === String(req.user.id)) {
      const { plan_id, billing_cycle } = checkoutSession.metadata
      await upgradePlan(req.user.id, plan_id, { ref: checkoutSession.id, provider: 'stripe' })
      return res.json({ ok: true })
    }
    return res.status(400).json({ error: 'Payment not completed' })
  } catch {
    // Not a Stripe session — fall through to PayPal
  }

  // Try PayPal order capture
  try {
    const token = await getPayPalToken()
    const captureRes = await fetch(
      `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${session}/capture`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )
    const capture = await captureRes.json()
    if (capture.status === 'COMPLETED') {
      const custom = capture.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id ?? ''
      const [userId, planId, billingCycle] = custom.split(':')
      if (String(userId) !== String(req.user.id)) {
        return res.status(403).json({ error: 'User mismatch' })
      }
      await upgradePlan(req.user.id, planId, { ref: capture.id, provider: 'paypal' })
      return res.json({ ok: true })
    }
    return res.status(400).json({ error: 'PayPal capture failed' })
  } catch (e) {
    console.error('Verify error:', e)
    return res.status(500).json({ error: 'Verification failed' })
  }
})

export default router