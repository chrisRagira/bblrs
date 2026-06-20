import { Router } from 'express';
import { db } from '../server.js';
import { requireAuth } from './auth.js';
import jwt from 'jsonwebtoken';

const router = Router();

// Admin auth middleware
function requireAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    if (!payload.is_admin) return res.status(403).json({ error: 'Admin only' });
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.use(requireAdmin);

// GET /api/admin/stats — system overview
router.get('/stats', async (req, res) => {
  const yearMonth = new Date().toISOString().slice(0, 7);
  const [users, usage, topUsers] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE active) as active_users,
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week,
        json_object_agg(p.name, user_count) as by_plan
      FROM (
        SELECT plan_id, COUNT(*) as user_count FROM users GROUP BY plan_id
      ) pc JOIN plans p ON p.id = pc.plan_id,
      users
    `),
    db.query(`
      SELECT
        SUM(bytes_total)::bigint as total_bytes,
        SUM(req_total)::bigint as total_requests
      FROM usage_monthly WHERE year_month = $1
    `, [yearMonth]),
    db.query(`
      SELECT u.email, p.name as plan, um.bytes_total, um.req_total
      FROM usage_monthly um
      JOIN users u ON u.id = um.user_id
      JOIN plans p ON p.id = u.plan_id
      WHERE um.year_month = $1
      ORDER BY um.bytes_total DESC LIMIT 10
    `, [yearMonth]),
  ]);

  res.json({
    users: users.rows[0],
    usage_this_month: usage.rows[0],
    top_users_by_bandwidth: topUsers.rows,
  });
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const { page = 1, limit = 50, search } = req.query;
  const offset = (page - 1) * limit;
  const where = search ? `WHERE u.email ILIKE $3` : '';
  const params = search
    ? [limit, offset, `%${search}%`]
    : [limit, offset];

  const result = await db.query(`
    SELECT u.id, u.email, u.active, u.verified, u.created_at,
           p.name as plan,
           COUNT(ak.id) as key_count
    FROM users u
    JOIN plans p ON p.id = u.plan_id
    LEFT JOIN api_keys ak ON ak.user_id = u.id AND ak.active = TRUE
    ${where}
    GROUP BY u.id, p.name
    ORDER BY u.created_at DESC
    LIMIT $1 OFFSET $2
  `, params);

  res.json(result.rows);
});

// PUT /api/admin/users/:id/plan
router.put('/users/:id/plan', async (req, res) => {
  const { plan_name } = req.body;
  const planResult = await db.query(`SELECT id FROM plans WHERE name = $1`, [plan_name]);
  if (!planResult.rows.length) return res.status(404).json({ error: 'Plan not found' });

  await db.query(`UPDATE users SET plan_id = $1 WHERE id = $2`, [planResult.rows[0].id, req.params.id]);
  res.json({ updated: true });
});

// PUT /api/admin/users/:id/suspend
router.put('/users/:id/suspend', async (req, res) => {
  await db.query(`UPDATE users SET active = FALSE WHERE id = $1`, [req.params.id]);
  res.json({ suspended: true });
});

export default router;