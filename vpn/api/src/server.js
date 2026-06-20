import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import { createClient } from 'redis';
import pg from 'pg';

import authRoutes from './routes/auth.js';
import keysRoutes from './routes/keys.js';
import usageRoutes from './routes/usage.js';
import adminRoutes from './routes/admin.js';
import proxyAuthMiddleware from './middleware/proxyAuth.js';
import resolveKeyRouter from './routes/resolveKey.js';

import webhookRouter  from './routes/webhooks.js'
import billingRouter  from './routes/billing.js'

const app = express();
const PORT = process.env.PORT || 4000;

// ── Database ──────────────────────────────────────────────────────────────────
export const db = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'proxyaas',
  user: process.env.DB_USER || 'proxyaas',
  password: process.env.DB_PASSWORD,
  max: 20,
});

// ── Redis ─────────────────────────────────────────────────────────────────────
export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});
await redis.connect();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(morgan('combined'));

// Global rate limit on API endpoints (not proxy)
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, slow down.' },
}));

// ── Routes ────────────────────────────────────────────────────────────────────
// Webhooks FIRST — before express.json() — Stripe needs raw body
app.use('/webhooks', webhookRouter)
app.use(express.json());

app.use('/api/billing', billingRouter)
app.use('/api/resolve-key', resolveKeyRouter);
app.use('/api/auth', authRoutes);
app.use('/api/keys', keysRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/admin', adminRoutes);

// Squid calls this to validate a proxy request
// GET /proxy-auth?user=<apikey>&pass=<apikey>
app.get('/proxy-auth', proxyAuthMiddleware);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

app.get('/api/nodes', async (req, res) => {
  const result = await db.query('SELECT * FROM proxy_nodes')
  res.json(result.rows)
})

app.listen(PORT, () => console.log(`API listening on :${PORT}`));
