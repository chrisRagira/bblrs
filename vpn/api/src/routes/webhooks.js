/**
 * routes/webhooks.js
 *
 * Mount in server.js BEFORE express.json() so Stripe can verify raw body:
 *
 *   import webhookRouter from './routes/webhooks.js'
 *   app.use('/webhooks', webhookRouter)   // <-- before app.use(express.json())
 *
 * POST /webhooks/stripe
 * POST /webhooks/mpesa
 * POST /webhooks/paypal   (IPN — optional fallback; primary flow is capture in billing.js)
 */

import { Router }        from 'express'
import Stripe            from 'stripe'
import express           from 'express'
import { db }            from '../server.js'

const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upgradePlan(userId, planId, paymentRef) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE users SET plan_id = (SELECT id FROM plans WHERE name ILIKE $2) WHERE id = $1`,
      [userId, planId]
    )
    await client.query(
      `INSERT INTO billing_events (user_id, plan_id, payment_ref, provider, status)
       VALUES ($1, $2, $3, $4, 'success')
       ON CONFLICT (payment_ref) DO NOTHING`,
      [userId, planId, paymentRef.ref, paymentRef.provider]
    )
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

// ── Stripe webhook ────────────────────────────────────────────────────────────
// Needs raw body — use express.raw() for this route only

router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature']
    let event

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (e) {
      console.error('Stripe webhook signature failed:', e.message)
      return res.status(400).send(`Webhook Error: ${e.message}`)
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      if (session.payment_status !== 'paid') return res.json({ received: true })

      const userId      = session.client_reference_id
      const { plan_id } = session.metadata

      try {
        await upgradePlan(userId, plan_id, { ref: session.id, provider: 'stripe' })
        console.log(`Stripe: upgraded user ${userId} to ${plan_id}`)
      } catch (e) {
        console.error('Stripe upgrade failed:', e)
        return res.status(500).json({ error: 'Upgrade failed' })
      }
    }

    // Handle subscription renewals
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object
      const sub = await stripe.subscriptions.retrieve(invoice.subscription)
      const userId  = sub.metadata?.user_id
      const plan_id = sub.metadata?.plan_id
      if (userId && plan_id) {
        await upgradePlan(userId, plan_id, { ref: invoice.id, provider: 'stripe' }).catch(console.error)
      }
    }

    res.json({ received: true })
  }
)

// ── M-Pesa callback ───────────────────────────────────────────────────────────

router.post('/mpesa', express.json(), async (req, res) => {
  // Safaricom always expects 200 immediately
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' })

  const callback = req.body?.Body?.stkCallback
  if (!callback) return

  const checkoutId  = callback.CheckoutRequestID
  const resultCode  = callback.ResultCode   // 0 = success

  if (resultCode !== 0) {
    // Payment failed or was cancelled — mark in pending_payments
    await db.query(
      `UPDATE pending_payments SET status = 'failed', failure_reason = $1
       WHERE provider_ref = $2`,
      [callback.ResultDesc, checkoutId]
    ).catch(console.error)
    return
  }

  // Extract M-Pesa receipt number from CallbackMetadata
  const items  = callback.CallbackMetadata?.Item ?? []
  const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value ?? checkoutId

  // Look up the pending payment to get user_id + plan_id
  const result = await db.query(
    `UPDATE pending_payments SET status = 'success'
     WHERE provider_ref = $1 AND status = 'pending'
     RETURNING user_id, plan_id, billing_cycle`,
    [checkoutId]
  )

  if (!result.rows.length) return  // already processed or not found

  const { user_id, plan_id } = result.rows[0]

  await upgradePlan(user_id, plan_id, { ref: receipt, provider: 'mpesa' }).catch(console.error)
  console.log(`M-Pesa: upgraded user ${user_id} to ${plan_id} (ref: ${receipt})`)
})

// ── PayPal IPN (optional fallback) ────────────────────────────────────────────

router.post('/paypal', express.json(), async (req, res) => {
  res.sendStatus(200)

  const { payment_status, custom, txn_id } = req.body
  if (payment_status !== 'Completed' || !custom) return

  const [userId, planId] = custom.split(':')
  if (!userId || !planId) return

  await upgradePlan(userId, planId, { ref: txn_id, provider: 'paypal' }).catch(console.error)
  console.log(`PayPal IPN: upgraded user ${userId} to ${planId}`)
})

export default router