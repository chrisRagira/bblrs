import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../server.js';
import { requireAuth } from './auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/keys — list user's keys
router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT id, key_prefix, label, active, last_used, created_at
     FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

// POST /api/keys — create a new key
router.post('/', async (req, res) => {
  const { label, location = 'United States'  } = req.body;

  // Check plan key limit
  const planResult = await db.query(
    `SELECT p.max_keys FROM plans p
     JOIN users u ON u.plan_id = p.id WHERE u.id = $1`,
    [req.user.id]
  );
  const maxKeys = planResult.rows[0]?.max_keys ?? 1;

  const countResult = await db.query(
    `SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND active = TRUE`,
    [req.user.id]
  );
  if (parseInt(countResult.rows[0].count) >= maxKeys) {
    return res.status(403).json({
      error: `Your plan allows up to ${maxKeys} active key(s). Upgrade to create more.`
    });
  }
  

  const node = await db.query(
    'SELECT * FROM proxy_nodes WHERE label = $1 AND active = TRUE',
    [location]
  )
  if (!node.rows.length) return res.status(400).json({ error: 'Invalid location' })


  // Generate: "pak_<32 random hex chars>"
  const rawKey = `pak_${crypto.randomBytes(20).toString('hex')}`;
  const keyPrefix = rawKey.slice(0, 8);
  const keyHash = await bcrypt.hash(rawKey, 10);

  const result = await db.query(
    `INSERT INTO api_keys (user_id, key_hash, key_prefix, label,location)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, key_prefix, label, active, created_at`,
    [req.user.id, keyHash, keyPrefix, label,location]
  );

  // Return raw key ONCE — never stored in plaintext
  res.status(201).json({
    ...result.rows[0],
    key: rawKey,
    warning: 'Save this key now — it will not be shown again.',
  });
});

// DELETE /api/keys/:id — revoke a key
router.delete('/:id', async (req, res) => {
  const result = await db.query(
    `UPDATE api_keys SET active = FALSE
     WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Key not found' });
  res.json({ revoked: true });
});


//  — list available locations
router.get('/locations', async (req, res) => {
  const result = await db.query(
    'SELECT location, label, ip FROM proxy_nodes WHERE active = TRUE'
  )
  res.json(result.rows)
})

export default router;
