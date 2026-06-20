#!/bin/bash
# =============================================================================
# startup-optimized.sh
# Installs the full ProxyAaS stack on a single spot VM:
#   Node.js API (with better-sqlite3) + Squid + Nginx + Certbot
# =============================================================================

set -euo pipefail
LOG="/var/log/proxyaas-setup.log"
exec > >(tee -a "$LOG") 2>&1
echo "=== ProxyAaS startup $(date) ==="

# ── 1. System deps ────────────────────────────────────────────────────────────
apt-get update -y
apt-get install -y \
  nginx certbot python3-certbot-nginx \
  squid curl ufw git build-essential python3

# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# ── 2. App directory ──────────────────────────────────────────────────────────
mkdir -p /opt/proxyaas
cd /opt/proxyaas

# ── 3. Fetch JWT secret via Secret Manager REST API (no gcloud CLI needed) ──────
# Uses the VM's metadata-server OAuth token. We granted secretAccessor in
# deploy-prod-optimized.sh so this works without elevated gcloud scopes.
PROJECT_ID=$(curl -sf "http://metadata.google.internal/computeMetadata/v1/project/project-id" \
  -H "Metadata-Flavor: Google")
ACCESS_TOKEN=$(curl -sf \
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" \
  -H "Metadata-Flavor: Google" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

JWT_SECRET=$(curl -sf \
  "https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/proxyaas-jwt/versions/latest:access" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  | python3 -c "import sys,json,base64; print(base64.b64decode(json.load(sys.stdin)['payload']['data']).decode())" \
  2>/dev/null) || true

# Fallback: generate locally if Secret Manager fetch failed
if [[ -z "$JWT_SECRET" ]]; then
  echo "WARNING: Secret Manager fetch failed — generating JWT secret locally"
  JWT_SECRET=$(openssl rand -hex 32)
fi

# ── 4. Write .env ─────────────────────────────────────────────────────────────
cat > /opt/proxyaas/.env <<EOF
NODE_ENV=production
PORT=4000
JWT_SECRET=$JWT_SECRET
DB_PATH=/opt/proxyaas/data/proxyaas.db
EOF
chmod 600 /opt/proxyaas/.env
mkdir -p /opt/proxyaas/data

# ── 5. Write package.json ─────────────────────────────────────────────────────
cat > /opt/proxyaas/package.json <<'PKG'
{
  "name": "proxyaas-api",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "better-sqlite3": "^11.0.0",
    "cors": "^2.8.5",
    "express": "^5.0.1",
    "express-rate-limit": "^7.4.1",
    "helmet": "^8.0.0",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0"
  }
}
PKG

# ── 6. Write the API server ───────────────────────────────────────────────────
# Uses better-sqlite3 (synchronous, embedded — no Cloud SQL needed)
# Uses an in-process Map for rate limiting (no Redis needed)
cat > /opt/proxyaas/server.js <<'SERVER'
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';
import { readFileSync } from 'fs';

// ── Config ────────────────────────────────────────────────────────────────────
const ENV = Object.fromEntries(
  readFileSync('/opt/proxyaas/.env', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => l.split('='))
);
const JWT_SECRET = ENV.JWT_SECRET;
const PORT = ENV.PORT || 4000;

// ── SQLite (replaces Cloud SQL — zero cost, zero ops) ─────────────────────────
const db = new Database(ENV.DB_PATH || './data/proxyaas.db');
db.pragma('journal_mode = WAL');  // better concurrency
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY, name TEXT UNIQUE, price_usd REAL,
    bandwidth_gb_month INTEGER, req_per_min INTEGER, max_keys INTEGER
  );
  INSERT OR IGNORE INTO plans VALUES
    (1,'free',0,5,10,1),(2,'starter',9,50,60,3),
    (3,'pro',29,200,200,10),(4,'business',99,-1,600,50);

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT,
    plan_id INTEGER DEFAULT 1, active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(plan_id) REFERENCES plans(id)
  );
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY, user_id TEXT, key_hash TEXT UNIQUE,
    key_prefix TEXT, label TEXT, active INTEGER DEFAULT 1,
    last_used TEXT, created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS usage_monthly (
    user_id TEXT, year_month TEXT,
    bytes_total INTEGER DEFAULT 0, req_total INTEGER DEFAULT 0,
    PRIMARY KEY(user_id, year_month)
  );
`);

// ── In-process rate limiter (replaces Redis — zero cost) ──────────────────────
// Map: keyId → { count, resetAt }
// Resets on restart — acceptable for a proxy service.
const rateLimitStore = new Map();
function checkRateLimit(keyId, maxRpm) {
  const now = Date.now();
  let entry = rateLimitStore.get(keyId);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 60_000 };
  }
  entry.count++;
  rateLimitStore.set(keyId, entry);
  return entry.count <= maxRpm;
}
// Cleanup stale entries every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitStore) if (now > v.resetAt) rateLimitStore.delete(k);
}, 300_000);

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));
app.use('/api', rateLimit({ windowMs: 60_000, max: 60 }));

// ── Auth helpers ──────────────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, plan_id: user.plan_id }, JWT_SECRET, { expiresIn: '7d' });
}
function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password?.length >= 8) return res.status(400).json({ error: 'Invalid input' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').run(id, email.toLowerCase(), hash);
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    res.status(201).json({ token: signToken(user), user: { id, email } });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Email taken' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare(`
    SELECT u.*, p.req_per_min, p.bandwidth_gb_month, p.max_keys
    FROM users u JOIN plans p ON p.id=u.plan_id
    WHERE u.email=? AND u.active=1
  `).get(email?.toLowerCase());
  if (!user || !await bcrypt.compare(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: signToken(user), user: { id: user.id, email: user.email, plan: user.name } });
});

// ── GET /api/keys ─────────────────────────────────────────────────────────────
app.get('/api/keys', requireAuth, (req, res) => {
  const keys = db.prepare(
    'SELECT id,key_prefix,label,active,last_used,created_at FROM api_keys WHERE user_id=? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json(keys);
});

// ── POST /api/keys ────────────────────────────────────────────────────────────
app.post('/api/keys', requireAuth, async (req, res) => {
  const plan = db.prepare('SELECT p.* FROM plans p JOIN users u ON u.plan_id=p.id WHERE u.id=?').get(req.user.id);
  const count = db.prepare('SELECT COUNT(*) as n FROM api_keys WHERE user_id=? AND active=1').get(req.user.id).n;
  if (count >= plan.max_keys) return res.status(403).json({ error: `Plan allows ${plan.max_keys} key(s). Upgrade to add more.` });

  const rawKey = `pak_${crypto.randomBytes(20).toString('hex')}`;
  const keyHash = await bcrypt.hash(rawKey, 10);
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO api_keys (id,user_id,key_hash,key_prefix,label) VALUES (?,?,?,?,?)')
    .run(id, req.user.id, keyHash, rawKey.slice(0, 8), req.body.label || null);
  res.status(201).json({ id, key_prefix: rawKey.slice(0, 8), key: rawKey, warning: 'Save this key — shown once.' });
});

// ── DELETE /api/keys/:id ──────────────────────────────────────────────────────
app.delete('/api/keys/:id', requireAuth, (req, res) => {
  db.prepare('UPDATE api_keys SET active=0 WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ revoked: true });
});

// ── GET /api/usage ────────────────────────────────────────────────────────────
app.get('/api/usage', requireAuth, (req, res) => {
  const yearMonth = new Date().toISOString().slice(0, 7);
  const plan = db.prepare('SELECT p.* FROM plans p JOIN users u ON u.plan_id=p.id WHERE u.id=?').get(req.user.id);
  const usage = db.prepare('SELECT * FROM usage_monthly WHERE user_id=? AND year_month=?').get(req.user.id, yearMonth)
    || { bytes_total: 0, req_total: 0 };
  const limitBytes = plan.bandwidth_gb_month === -1 ? null : plan.bandwidth_gb_month * 1024 ** 3;
  res.json({
    period: yearMonth, plan: plan.name,
    bytes_used: usage.bytes_total, bytes_limit: limitBytes,
    bandwidth_pct: limitBytes ? Math.round((usage.bytes_total / limitBytes) * 100) : null,
    requests_total: usage.req_total, rate_limit_rpm: plan.req_per_min,
  });
});

// ── GET /proxy-auth  (called by Squid auth helper) ────────────────────────────
app.get('/proxy-auth', async (req, res) => {
  const apiKey = req.query.user || req.headers['x-proxy-key'];
  if (!apiKey?.startsWith('pak_')) return res.status(403).end();

  const prefix = apiKey.slice(0, 8);
  const rows = db.prepare(`
    SELECT ak.id, ak.key_hash, ak.user_id,
           p.req_per_min, p.bandwidth_gb_month
    FROM api_keys ak
    JOIN users u ON u.id=ak.user_id
    JOIN plans p ON p.id=u.plan_id
    WHERE ak.key_prefix=? AND ak.active=1 AND u.active=1
  `).all(prefix);

  let matched = null;
  for (const row of rows) {
    if (await bcrypt.compare(apiKey, row.key_hash)) { matched = row; break; }
  }
  if (!matched) return res.status(403).end();

  // Rate limit check
  if (!checkRateLimit(matched.id, matched.req_per_min)) return res.status(429).end();

  // Bandwidth check
  if (matched.bandwidth_gb_month !== -1) {
    const ym = new Date().toISOString().slice(0, 7);
    const u = db.prepare('SELECT bytes_total FROM usage_monthly WHERE user_id=? AND year_month=?').get(matched.user_id, ym);
    if ((u?.bytes_total || 0) >= matched.bandwidth_gb_month * 1024 ** 3) return res.status(403).end();
  }

  // Update last_used (async fire-and-forget)
  setImmediate(() => db.prepare('UPDATE api_keys SET last_used=datetime("now") WHERE id=?').run(matched.id));

  res.status(200).json({ ok: true, user_id: matched.user_id, key_id: matched.id });
});

// ── POST /api/usage/ingest  (called by log processor) ────────────────────────
app.post('/api/usage/ingest', (req, res) => {
  const ip = req.ip;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return res.status(403).end();
  const { user_id, bytes_recv = 0 } = req.body;
  if (!user_id) return res.status(400).end();
  const ym = new Date().toISOString().slice(0, 7);
  db.prepare(`
    INSERT INTO usage_monthly (user_id, year_month, bytes_total, req_total) VALUES (?,?,?,1)
    ON CONFLICT(user_id, year_month)
    DO UPDATE SET bytes_total=bytes_total+excluded.bytes_total, req_total=req_total+1
  `).run(user_id, ym, parseInt(bytes_recv));
  res.json({ ok: true });
});

app.get('/health', (_, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`ProxyAaS API :${PORT}`));
SERVER

# ── 7. Install npm deps ───────────────────────────────────────────────────────
cd /opt/proxyaas && npm install --omit=dev

# ── 8. Systemd service ────────────────────────────────────────────────────────
cat > /etc/systemd/system/proxyaas-api.service <<'SVC'
[Unit]
Description=ProxyAaS API
After=network.target

[Service]
Type=simple
User=nobody
WorkingDirectory=/opt/proxyaas
ExecStart=/usr/bin/node /opt/proxyaas/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SVC

systemctl daemon-reload
systemctl enable --now proxyaas-api

# ── 9. Squid ──────────────────────────────────────────────────────────────────
cat > /etc/squid/squid.conf <<'SQUID'
http_port 3128

external_acl_type proxy_auth_api ttl=60 negative_ttl=10 \
  children-max=20 concurrency=50 %LOGIN \
  /usr/local/bin/squid-auth-helper.sh

acl valid_api_key external proxy_auth_api
auth_param basic program /usr/lib/squid/basic_fake_auth
auth_param basic realm "ProxyAaS — use your API key as username"
acl authenticated proxy_auth REQUIRED

acl SSL_ports port 443
acl Safe_ports port 80 443 8080 1025-65535
acl CONNECT method CONNECT

http_access deny !Safe_ports
http_access deny CONNECT !SSL_ports
http_access deny !authenticated
http_access deny !valid_api_key
http_access allow authenticated valid_api_key
http_access deny all

forwarded_for delete
via off
request_header_access X-Forwarded-For deny all
request_header_access Via deny all

cache_mem 256 MB
cache_dir ufs /var/spool/squid 4096 16 256
access_log /var/log/squid/access.log squid
dns_nameservers 8.8.8.8 1.1.1.1
SQUID

cat > /usr/local/bin/squid-auth-helper.sh <<'HELPER'
#!/bin/bash
while read -r line; do
  KEY=$(echo "$line" | awk '{print $1}')
  [[ -z "$KEY" ]] && echo "ERR" && continue
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 3 \
    -H "X-Proxy-Key: $KEY" http://127.0.0.1:4000/proxy-auth)
  [[ "$STATUS" == "200" ]] && echo "OK" || echo "ERR"
done
HELPER
chmod +x /usr/local/bin/squid-auth-helper.sh

squid -z
systemctl enable --now squid

# ── 10. Nginx ─────────────────────────────────────────────────────────────────
cat > /etc/nginx/sites-available/proxyaas <<'NGINX'
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;

server {
    listen 80;
    server_name _;

    location /api/auth/ {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header X-Real-IP $remote_addr;
    }
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header X-Real-IP $remote_addr;
    }
    location /health { proxy_pass http://127.0.0.1:4000/health; }
    location / {
        root /var/www/proxyaas/dist;
        try_files $uri $uri/ /index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/proxyaas /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx

# ── 11. IP forwarding + UFW ───────────────────────────────────────────────────
sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw allow 3128/tcp
ufw --force enable

# ── 12. Auto-restart on spot preemption ──────────────────────────────────────
# GCP sends SIGTERM 30s before preemption; systemd Restart=always handles it.
# This cron ensures services are up after a stop/start cycle.
cat > /etc/cron.d/proxyaas-watchdog <<'CRON'
*/5 * * * * root systemctl is-active --quiet proxyaas-api || systemctl start proxyaas-api
*/5 * * * * root systemctl is-active --quiet squid || systemctl start squid
CRON

echo "=== Setup complete $(date) ==="
echo "API: http://localhost:4000/health"
echo "Proxy: localhost:3128"