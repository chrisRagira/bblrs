# ProxyAaS — Proxy as a Service

A production-grade HTTP/HTTPS proxy service with user accounts, API key auth,
usage tracking, rate limiting, and tiered billing plans.

## Architecture

```
                        ┌─────────────────────────────────────────┐
                        │              GCP                         │
                        │                                          │
Internet ──(HTTPS 443)──► Nginx ──► Node.js API (port 4000)       │
         ──(HTTP  3128)──► Squid ──► squid-auth-helper.sh          │
                        │               │                          │
                        │               ▼                          │
                        │          /proxy-auth endpoint            │
                        │               │                          │
                        │    ┌──────────┴──────────┐              │
                        │    │                     │              │
                        │  PostgreSQL            Redis            │
                        │  (users, keys,      (rate limits,      │
                        │   usage, billing)    sessions)         │
                        └─────────────────────────────────────────┘
```

## Components

| File/Dir | Purpose |
|---|---|
| `api/src/server.js` | Express API entry point |
| `api/src/schema.sql` | PostgreSQL schema |
| `api/src/routes/auth.js` | Register, login, JWT |
| `api/src/routes/keys.js` | API key CRUD |
| `api/src/routes/usage.js` | Usage stats + ingest |
| `api/src/routes/admin.js` | Admin dashboard endpoints |
| `api/src/middleware/proxyAuth.js` | Squid → API key validation |
| `squid/squid.conf` | Squid with external ACL auth |
| `squid/squid-auth-helper.sh` | Shell helper Squid calls per connection |
| `nginx/nginx.conf` | TLS termination + rate limiting |
| `scripts/log-processor.js` | Ships Squid logs → usage DB |
| `docker/docker-compose.yml` | Local dev stack |
| `infra/gcp/deploy-prod.sh` | Full GCP production deploy |
| `.env.example` | Environment variable template |

## Plans

| Plan | Price | Bandwidth | Rate Limit | Keys |
|---|---|---|---|---|
| Free | $0 | 5 GB/mo | 10 req/min | 1 |
| Starter | $9/mo | 50 GB/mo | 60 req/min | 3 |
| Pro | $29/mo | 200 GB/mo | 200 req/min | 10 |
| Business | $99/mo | Unlimited | 600 req/min | 50 |

## Local Development

```bash
# 1. Install deps
cd api && npm install

# 2. Set up env
cp .env.example .env  # edit values

# 3. Start all services
cd docker
docker-compose up -d

# 4. Apply schema
docker-compose exec postgres psql -U proxyaas -d proxyaas -f /docker-entrypoint-initdb.d/01-schema.sql

# 5. API is at http://localhost:4000
# 6. Proxy is at localhost:3128
```

## API Usage

### Register
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}'
# → {"token":"eyJ...","user":{...}}
```

### Create API Key
```bash
curl -X POST http://localhost:4000/api/keys \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"label":"my laptop"}'
# → {"key":"pak_abc123...","warning":"Save this key — shown once"}
```

### Use the Proxy
```bash
# HTTP proxy with API key as both username and password
curl -x http://proxy.yourdomain.com:3128 \
  -U "pak_abc123...:pak_abc123..." \
  https://api.ipify.org
```

### Browser Setup
- **Host:** proxy.yourdomain.com
- **Port:** 3128
- **Username:** your API key (pak_...)
- **Password:** your API key (same)

### Check Usage
```bash
curl http://localhost:4000/api/usage \
  -H "Authorization: Bearer <JWT>"
```

## Production Deployment (GCP)

```bash
# 1. Edit PROJECT, REGION, DOMAIN in infra/gcp/deploy-prod.sh
# 2. Run
chmod +x infra/gcp/deploy-prod.sh
./infra/gcp/deploy-prod.sh

# 3. After DNS propagates, get TLS cert
gcloud compute ssh proxyaas-api -- sudo certbot --nginx -d proxy.yourdomain.com

# 4. Apply schema to Cloud SQL
gcloud compute ssh proxyaas-api -- \
  psql "host=<CLOUD_SQL_IP> dbname=proxyaas user=proxyaas" < api/src/schema.sql
```

**Estimated GCP costs:**
| Resource | Cost |
|---|---|
| e2-medium (API VM) | ~$26/mo |
| e2-standard-2 (Proxy VM) | ~$52/mo |
| Cloud SQL db-g1-small | ~$26/mo |
| Memorystore Redis 1GB | ~$35/mo |
| Static IPs × 2 | ~$6/mo |
| Egress (100 GB) | ~$10/mo |
| **Total** | **~$155/mo** |

Breakeven on the Starter plan: ~18 users.

## Adding Stripe Billing

1. Create products/prices in Stripe dashboard matching the plans table
2. Add `stripe_customer_id` and `stripe_subscription_id` to the `users` table
3. Create `/api/billing/checkout` that calls `stripe.checkout.sessions.create()`
4. Handle `customer.subscription.updated` webhooks to update `plan_id`

## Security Checklist

- [ ] Change `JWT_SECRET` and `DB_PASSWORD` before deploying
- [ ] Restrict SSH firewall rule to your IP
- [ ] Enable Cloud SQL private IP (no public endpoint)
- [ ] Set up Cloud Armor for DDoS protection on the API VM
- [ ] Enable GCP Cloud Logging for audit trails
- [ ] Add HTTPS-only enforcement in Nginx
- [ ] Rotate API keys periodically (add expiry field to `api_keys`)
