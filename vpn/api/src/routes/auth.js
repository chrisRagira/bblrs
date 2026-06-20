import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../server.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 12;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be ≥ 8 chars' });

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, plan_id, created_at`,
      [email.toLowerCase().trim(), hash]
    );
    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user: sanitize(user) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const result = await db.query(
      `SELECT u.*, p.name as plan_name, p.req_per_min, p.bandwidth_gb_month, p.max_keys
       FROM users u JOIN plans p ON p.id = u.plan_id
       WHERE u.email = $1 AND u.active = TRUE`,
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    res.json({ token, user: sanitize(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT u.*, p.name as plan_name, p.req_per_min, p.bandwidth_gb_month, p.max_keys
     FROM users u JOIN plans p ON p.id = u.plan_id WHERE u.id = $1`,
    [req.user.id]
  );
  const user = result.rows[0];
  if (!user || !user.active) return res.status(401).json({ error: 'Account inactive' });
  res.json({ token: signToken(user), user: sanitize(user) });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, plan_id: user.plan_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function sanitize(u) {
  const { password_hash, ...rest } = u;
  return rest;
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export default router;
