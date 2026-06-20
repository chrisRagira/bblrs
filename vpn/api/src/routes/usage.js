import { Router } from 'express';
import { db } from '../server.js';
import { requireAuth } from './auth.js';

const router = Router();

/**
 * POST /api/usage/ingest — internal, secret-protected, no user auth
 */
router.post('/ingest', async (req, res) => {
  const secret = process.env.INGEST_SECRET;
  if (!secret || req.headers['x-internal-secret'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { entries } = req.body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries array required' });
  }

  for (const entry of entries) {
    const { user_id, api_key_id, status_code } = entry;
    if (!user_id || !api_key_id || status_code == null) {
      return res.status(400).json({ error: 'Each entry requires user_id, api_key_id, status_code' });
    }
  }

  const yearMonth = new Date().toISOString().slice(0, 7);
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    for (const entry of entries) {
      const {
        user_id,
        api_key_id,
        bytes_sent  = 0,
        bytes_recv  = 0,
        target_host = null,
        status_code,
      } = entry;

      const totalBytes = (parseInt(bytes_sent) || 0) + (parseInt(bytes_recv) || 0);

      await client.query(
        `INSERT INTO usage_logs (user_id, api_key_id, bytes_sent, bytes_recv, target_host, status_code)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user_id, api_key_id, bytes_sent, bytes_recv, target_host, status_code]
      );

      await client.query(
        `INSERT INTO usage_monthly (user_id, year_month, bytes_total)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, year_month)
         DO UPDATE SET bytes_total = usage_monthly.bytes_total + $3`,
        [user_id, yearMonth, totalBytes]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, processed: entries.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Usage ingest error:', err);
    res.status(500).json({ error: 'Ingest failed' });
  } finally {
    client.release();
  }
});

// All routes below require user auth
router.use(requireAuth);

// GET /api/usage — current month summary
router.get('/', async (req, res) => {
  const yearMonth = new Date().toISOString().slice(0, 7);

  const [monthly, planResult, recentResult] = await Promise.all([
    db.query(
      `SELECT bytes_total FROM usage_monthly
       WHERE user_id = $1 AND year_month = $2`,
      [req.user.id, yearMonth]
    ),
    db.query(
      `SELECT p.name, p.bandwidth_gb_month FROM plans p
       JOIN users u ON u.plan_id = p.id WHERE u.id = $1`,
      [req.user.id]
    ),
    db.query(
      `SELECT DATE(logged_at) as date,
              SUM(bytes_sent + bytes_recv) as bytes
       FROM usage_logs
       WHERE user_id = $1 AND logged_at > NOW() - INTERVAL '30 days'
       GROUP BY DATE(logged_at)
       ORDER BY date DESC`,
      [req.user.id]
    ),
  ]);

  const plan     = planResult.rows[0];
  const usage    = monthly.rows[0] || { bytes_total: 0 };
  const bytesUsed  = parseInt(usage.bytes_total) || 0;
  const limitBytes = plan.bandwidth_gb_month === -1
    ? null
    : plan.bandwidth_gb_month * 1024 ** 3;

  res.json({
    period:        yearMonth,
    plan:          plan.name,
    bytes_used:    bytesUsed,
    bytes_limit:   limitBytes,
    bandwidth_pct: limitBytes ? Math.round((bytesUsed / limitBytes) * 100) : null,
    daily:         recentResult.rows,
  });
});

// GET /api/usage/history — past months
router.get('/history', async (req, res) => {
  const result = await db.query(
    `SELECT year_month, bytes_total
     FROM usage_monthly WHERE user_id = $1
     ORDER BY year_month DESC LIMIT 12`,
    [req.user.id]
  );
  res.json(result.rows);
});

export default router;