
#!/bin/bash
# =============================================================================
# deploy-prod-optimized.sh
# ProxyAaS — cost-optimized GCP deployment
#
# BEFORE: $155/mo (2 VMs + Cloud SQL + Memorystore + 2 static IPs)
# AFTER:  ~$19/mo (1 spot e2-micro + SQLite + in-process cache + 1 static IP)
#
# Trade-offs vs the expensive version:
#  - No managed DB: SQLite on disk (fine up to ~10k users, easy to migrate later)
#  - No Redis: in-process Map for rate limiting (resets on restart, acceptable)
#  - Spot VM: ~80% cheaper; GCP may preempt, systemd auto-restarts on resume
#  - Single VM: API + Squid co-located (saves the second VM + IP entirely)
#  - When you outgrow this: swap SQLite → Cloud SQL, add Redis, split VMs
# =============================================================================

set -euo pipefail

PROJECT="pristine-gadget-450306-q3"
REGION="us-central1"
ZONE="us-central1-a"
VM_NAME="proxyaas"
DOMAIN="http://35.209.144.131"

# e2-micro spot = ~$3.50/mo  |  e2-small spot = ~$7/mo (more headroom)
MACHINE_TYPE="e2-small"
DISK_SIZE="20"

echo "Deploying optimized ProxyAaS → project: $PROJECT"
gcloud config set project "$PROJECT"

# ── 0. Enable APIs (must run as YOUR account, not the VM service account) ─────
# This runs locally with your gcloud credentials before the VM is created.
# The VM's startup script must NOT call gcloud services enable — the Compute
# default service account lacks the serviceusage.services.enable permission.
echo "→ Enabling APIs (as $(gcloud config get-value account))..."
gcloud services enable \
  compute.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT"

# Grant the default Compute service account permission to READ secrets.
# (It does not need to enable APIs — only read the JWT secret at startup.)
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format="value(projectNumber)")
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "→ Granting Secret Manager accessor to $SA..."
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$SA" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None \
  --quiet

# ── 1. ONE static IP (not two) ────────────────────────────────────────────────
echo "→ Reserving static IP..."
gcloud compute addresses create proxyaas-ip \
  --region="$REGION" --project="$PROJECT" 2>/dev/null || true

STATIC_IP=$(gcloud compute addresses describe proxyaas-ip \
  --region="$REGION" --format="value(address)")
echo "  IP: $STATIC_IP"

# ── 2. Firewall rules ─────────────────────────────────────────────────────────
echo "→ Firewall rules..."
gcloud compute firewall-rules create proxyaas-web \
  --rules=tcp:22,tcp:80,tcp:443,tcp:3128 \
  --target-tags=proxyaas \
  --source-ranges=0.0.0.0/0 \
  --project="$PROJECT" 2>/dev/null || true

# ── 3. Secrets ────────────────────────────────────────────────────────────────
JWT_SECRET=$(openssl rand -hex 32)
echo -n "$JWT_SECRET" | gcloud secrets create proxyaas-jwt \
  --data-file=- --project="$PROJECT" 2>/dev/null || true

# ── 4. Single spot VM ─────────────────────────────────────────────────────────
echo "→ Creating spot VM ($MACHINE_TYPE)..."
gcloud compute instances create "$VM_NAME" \
  --zone="$ZONE" \
  --machine-type="$MACHINE_TYPE" \
  --provisioning-model=SPOT \
  --instance-termination-action=STOP \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size="${DISK_SIZE}GB" \
  --boot-disk-type=pd-balanced \
  --tags=proxyaas \
  --address=proxyaas-ip \
  --metadata-from-file=startup-script=startup-optimized.sh \
  --project="$PROJECT" \
  2>/dev/null || echo "  (VM exists)"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ProxyAaS — optimized deployment complete       ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  IP        : $STATIC_IP"
echo "║  Domain    : $DOMAIN  →  $STATIC_IP"
echo "║  Cost      : ~\$19/mo  (was \$155/mo)"
echo "╠══════════════════════════════════════════════════╣"
echo "║  NEXT:                                           ║"
echo "║  1. Point DNS A record → $STATIC_IP"
echo "║  2. Watch startup: (takes ~3 min)                ║"
echo "║     gcloud compute ssh $VM_NAME --zone=$ZONE \   ║"
echo "║       -- sudo journalctl -fu proxyaas-api        ║"
echo "║  3. Get TLS cert:                                ║"
echo "║     gcloud compute ssh $VM_NAME --zone=$ZONE \   ║"
echo "║       -- sudo certbot --nginx -d $DOMAIN         ║"
echo "╚══════════════════════════════════════════════════╝"