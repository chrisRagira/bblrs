#!/bin/bash
# =============================================================================
# infra/gcp/deploy-prod.sh
# Full GCP production deployment for ProxyAaS
# Uses: Compute Engine (API+Squid), Cloud SQL (Postgres), Memorystore (Redis)
# =============================================================================

set -euo pipefail

# ── Config — edit these ───────────────────────────────────────────────────────
PROJECT="your-gcp-project-id"
REGION="us-central1"
ZONE="us-central1-a"
DOMAIN="proxy.yourdomain.com"

# VM sizing
API_VM="proxyaas-api"
PROXY_VM="proxyaas-proxy"
MACHINE_API="e2-medium"       # 2 vCPU, 4 GB — API + Nginx
MACHINE_PROXY="e2-standard-2" # 2 vCPU, 8 GB — Squid (RAM for cache)

# Cloud SQL
SQL_INSTANCE="proxyaas-pg"
SQL_TIER="db-g1-small"        # ~$26/month; scale up as needed
SQL_DB="proxyaas"
SQL_USER="proxyaas"

# Memorystore Redis
REDIS_INSTANCE="proxyaas-redis"
REDIS_TIER="BASIC"
REDIS_SIZE_GB=1

echo "Deploying ProxyAaS to GCP project: $PROJECT"
gcloud config set project "$PROJECT"

# ── 1. Enable APIs ────────────────────────────────────────────────────────────
echo "→ Enabling GCP APIs..."
gcloud services enable \
  compute.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT"

# ── 2. Cloud SQL (Postgres) ───────────────────────────────────────────────────
echo "→ Creating Cloud SQL instance (takes ~5 min)..."
gcloud sql instances create "$SQL_INSTANCE" \
  --database-version=POSTGRES_16 \
  --tier="$SQL_TIER" \
  --region="$REGION" \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --project="$PROJECT" \
  2>/dev/null || echo "  (SQL instance exists)"

gcloud sql databases create "$SQL_DB" \
  --instance="$SQL_INSTANCE" --project="$PROJECT" 2>/dev/null || true

DB_PASSWORD=$(openssl rand -hex 24)
gcloud sql users create "$SQL_USER" \
  --instance="$SQL_INSTANCE" \
  --password="$DB_PASSWORD" \
  --project="$PROJECT" 2>/dev/null || true

# Store in Secret Manager
echo -n "$DB_PASSWORD" | gcloud secrets create proxyaas-db-password \
  --data-file=- --project="$PROJECT" 2>/dev/null || \
  echo -n "$DB_PASSWORD" | gcloud secrets versions add proxyaas-db-password \
  --data-file=- --project="$PROJECT"

# ── 3. Memorystore Redis ──────────────────────────────────────────────────────
echo "→ Creating Redis instance..."
gcloud redis instances create "$REDIS_INSTANCE" \
  --size="$REDIS_SIZE_GB" \
  --region="$REGION" \
  --tier="$REDIS_TIER" \
  --project="$PROJECT" \
  2>/dev/null || echo "  (Redis exists)"

REDIS_IP=$(gcloud redis instances describe "$REDIS_INSTANCE" \
  --region="$REGION" --format="value(host)")

# ── 4. JWT Secret ─────────────────────────────────────────────────────────────
JWT_SECRET=$(openssl rand -hex 32)
echo -n "$JWT_SECRET" | gcloud secrets create proxyaas-jwt-secret \
  --data-file=- --project="$PROJECT" 2>/dev/null || \
  echo "  (JWT secret exists)"

# ── 5. Static IPs ────────────────────────────────────────────────────────────
echo "→ Reserving static IPs..."
gcloud compute addresses create proxyaas-api-ip --region="$REGION" --project="$PROJECT" 2>/dev/null || true
gcloud compute addresses create proxyaas-proxy-ip --region="$REGION" --project="$PROJECT" 2>/dev/null || true

API_IP=$(gcloud compute addresses describe proxyaas-api-ip --region="$REGION" --format="value(address)")
PROXY_IP=$(gcloud compute addresses describe proxyaas-proxy-ip --region="$REGION" --format="value(address)")

# ── 6. Firewall Rules ─────────────────────────────────────────────────────────
echo "→ Creating firewall rules..."
gcloud compute firewall-rules create proxyaas-allow-http-https \
  --rules=tcp:80,tcp:443 --target-tags=proxyaas-api \
  --source-ranges=0.0.0.0/0 --project="$PROJECT" 2>/dev/null || true

gcloud compute firewall-rules create proxyaas-allow-proxy \
  --rules=tcp:3128 --target-tags=proxyaas-proxy \
  --source-ranges=0.0.0.0/0 --project="$PROJECT" 2>/dev/null || true

gcloud compute firewall-rules create proxyaas-internal \
  --rules=tcp:4000 --target-tags=proxyaas-proxy \
  --source-tags=proxyaas-proxy --project="$PROJECT" 2>/dev/null || true

# ── 7. API VM (Nginx + Node.js) ───────────────────────────────────────────────
echo "→ Creating API VM..."
gcloud compute instances create "$API_VM" \
  --zone="$ZONE" \
  --machine-type="$MACHINE_API" \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB \
  --tags=proxyaas-api \
  --address=proxyaas-api-ip \
  --metadata="startup-script=$(cat infra/gcp/api-startup.sh)" \
  --project="$PROJECT" \
  2>/dev/null || echo "  (API VM exists)"

# ── 8. Proxy VM (Squid) ───────────────────────────────────────────────────────
echo "→ Creating Proxy VM..."
gcloud compute instances create "$PROXY_VM" \
  --zone="$ZONE" \
  --machine-type="$MACHINE_PROXY" \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --tags=proxyaas-proxy \
  --address=proxyaas-proxy-ip \
  --metadata="startup-script=$(cat infra/gcp/proxy-startup.sh)" \
  --project="$PROJECT" \
  2>/dev/null || echo "  (Proxy VM exists)"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║           ProxyAaS GCP Deployment Complete           ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  API / Dashboard : https://$DOMAIN"
echo "║  API IP          : $API_IP"
echo "║  Proxy endpoint  : $PROXY_IP:3128"
echo "║  Redis IP        : $REDIS_IP"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  NEXT STEPS:                                         ║"
echo "║  1. Point $DOMAIN DNS A record → $API_IP  ║"
echo "║  2. SSH into API VM, run: certbot --nginx            ║"
echo "║  3. SSH into API VM, apply schema.sql to Cloud SQL   ║"
echo "║  4. Deploy React dashboard to /var/www/proxyaas/dist ║"
echo "╚══════════════════════════════════════════════════════╝"
