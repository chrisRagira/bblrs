/**
 * proxyAuth.js
 *
 * Squid calls GET /proxy-auth?user=<apikey>&pass=<apikey>
 * via the url_rewrite_program or external_acl_type directive.
 *
 * We validate the key, check:
 *  1. Key exists and is active
 *  2. User account is active
 *  3. Rate limit not exceeded (Redis counter)
 *  4. Monthly bandwidth not exceeded
 *
 * Respond with HTTP 200 (allow) or 403 (deny).
 * Squid interprets 2xx = OK, anything else = deny.
 */

import bcrypt from 'bcrypt';
import { db, redis } from '../server.js';

export default async function proxyAuth(req, res) {
  const apiKey = req.query.user || req.headers['x-proxy-key'];

  if (!apiKey?.startsWith('pak_')) {
    return res.status(403).json({ error: 'Missing or invalid API key' });
  }

  try {
    // ── 1. Look up key by prefix (fast), then bcrypt verify ──────────────────
    const prefix = apiKey.slice(0, 8);
    const keys = await db.query(
      `SELECT ak.id, ak.key_hash, ak.user_id, ak.active as key_active,
              u.active as user_active, u.plan_id,
              p.req_per_min, p.bandwidth_gb_month
       FROM api_keys ak
       JOIN users u ON u.id = ak.user_id
       JOIN plans p ON p.id = u.plan_id
       WHERE ak.key_prefix = $1 AND ak.active = TRUE AND u.active = TRUE`,
      [prefix]
    );

    if (!keys.rows.length) return res.status(403).json({ error: 'Denied' });

    // Find matching key (there could be multiple with same prefix, unlikely but safe)
    let matchedKey = null;
    for (const row of keys.rows) {
      if (await bcrypt.compare(apiKey, row.key_hash)) {
        matchedKey = row;
        break;
      }
    }
    if (!matchedKey) return res.status(403).json({ error: 'Denied' });

    // ── 2. Rate limit check (Redis sliding window) ────────────────────────────
    const rateLimitKey = `rl:${matchedKey.id}`;
    const count = await redis.incr(rateLimitKey);
    if (count === 1) await redis.expire(rateLimitKey, 60); // 1-minute window

    if (count > matchedKey.req_per_min) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    // ── 3. Monthly bandwidth check ────────────────────────────────────────────
    if (matchedKey.bandwidth_gb_month !== -1) {
      const yearMonth = new Date().toISOString().slice(0, 7);
      const usageResult = await db.query(
        `SELECT bytes_total FROM usage_monthly WHERE user_id = $1 AND year_month = $2`,
        [matchedKey.user_id, yearMonth]
      );
      const usedBytes = parseInt(usageResult.rows[0]?.bytes_total || 0);
      const limitBytes = matchedKey.bandwidth_gb_month * 1024 * 1024 * 1024;
      if (usedBytes >= limitBytes) {
        return res.status(403).json({ error: 'Monthly bandwidth limit exceeded' });
      }
    }

    // ── 4. Update last_used asynchronously ───────────────────────────────────
    db.query(`UPDATE api_keys SET last_used = NOW() WHERE id = $1`, [matchedKey.id])
      .catch(console.error);

    // ── 5. Allow ──────────────────────────────────────────────────────────────
    res.set('X-Proxy-User', matchedKey.user_id);
    res.set('X-Key-Id', matchedKey.id);
    res.status(200).json({ ok: true });

  } catch (err) {
    console.error('proxyAuth error:', err);
    res.status(500).json({ error: 'Auth service error' });
  }
}
