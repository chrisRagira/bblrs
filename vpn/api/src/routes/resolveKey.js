import { Router } from 'express';
import { db } from '../server.js';

const router = Router();

/**
 * GET /resolve-key?prefix=pak_802e
 * Internal endpoint — called by the Squid log processor to map an API key
 * prefix → { user_id, key_id }. Protected by shared secret, not user auth.
 */
router.get('/', async (req, res) => {
  // Shared-secret check (same env var used by log-processor)
  const secret = process.env.INGEST_SECRET;
  if (!secret || req.headers['x-internal-secret'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { prefix } = req.query;
  if (!prefix || typeof prefix !== 'string' || prefix.length < 4) {
    return res.status(400).json({ error: 'prefix required' });
  }

  const result = await db.query(
    `SELECT id, user_id FROM api_keys
     WHERE key_prefix = $1 AND active = TRUE
     LIMIT 1`,
    [prefix]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: 'Key not found' });
  }

  const { id, user_id } = result.rows[0];
  res.json({ key_id: id, user_id });
});

export default router;
