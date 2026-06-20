-- =============================================================================
-- ProxyAaS — PostgreSQL Schema
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Plans ─────────────────────────────────────────────────────────────────────
CREATE TABLE plans (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,          -- 'free', 'starter', 'pro', 'business'
  price_usd   NUMERIC(8,2) NOT NULL,
  bandwidth_gb_month INT NOT NULL,           -- -1 = unlimited
  req_per_min INT NOT NULL,                  -- rate limit
  max_keys    INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plans (name, price_usd, bandwidth_gb_month, req_per_min, max_keys) VALUES
  ('free',     0.00,   5,   10,  1),
  ('starter',  9.00,  50,   60,  3),
  ('pro',     29.00, 200,  200,  10),
  ('business',99.00,  -1,  600,  50);

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  plan_id      INT REFERENCES plans(id) DEFAULT 1,
  active       BOOLEAN DEFAULT TRUE,
  verified     BOOLEAN DEFAULT FALSE,
  is_admin     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── API Keys ──────────────────────────────────────────────────────────────────
CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash    TEXT NOT NULL UNIQUE,          -- bcrypt hash of the actual key
  key_prefix  TEXT NOT NULL,                 -- first 8 chars, shown in UI
  label       TEXT,
  active      BOOLEAN DEFAULT TRUE,
  last_used   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Usage Logs ────────────────────────────────────────────────────────────────
CREATE TABLE usage_logs (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id),
  api_key_id    UUID REFERENCES api_keys(id),
  bytes_sent    BIGINT DEFAULT 0,
  bytes_recv    BIGINT DEFAULT 0,
  req_count     INT DEFAULT 1,
  target_host   TEXT,
  status_code   INT,
  logged_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_user_month ON usage_logs (user_id, logged_at);
CREATE INDEX idx_usage_key ON usage_logs (api_key_id);

-- ── Monthly Aggregates (materialized for billing) ─────────────────────────────
CREATE TABLE usage_monthly (
  user_id       UUID REFERENCES users(id),
  year_month    TEXT NOT NULL,              -- '2026-05'
  bytes_total   BIGINT DEFAULT 0,
  PRIMARY KEY (user_id, year_month)
);

-- ── Billing (simple; swap for Stripe webhook data in prod) ────────────────────
CREATE TABLE invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  year_month    TEXT NOT NULL,
  amount_usd    NUMERIC(8,2) NOT NULL,
  paid          BOOLEAN DEFAULT FALSE,
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Add to your schema.sql
ALTER TABLE api_keys ADD COLUMN location TEXT DEFAULT 'United States';

CREATE TABLE proxy_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location    TEXT NOT NULL,        -- 'us-central1', 'europe-west1', etc.
  label       TEXT NOT NULL,        -- 'United States', 'Belgium', etc.
  ip          TEXT NOT NULL,        -- external IP of the squid VM
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO proxy_nodes (location, label, ip) VALUES
  ('us-central1',        'United States',  '35.209.144.131'),
  ('europe-west1',       'Belgium',        'YOUR_BELGIUM_IP'),
  ('asia-east1',         'Taiwan',         'YOUR_TAIWAN_IP'),
  ('southamerica-east1', 'Brazil',         'YOUR_BRAZIL_IP'),
  ('asia-southeast1',    'Singapore',      'YOUR_SINGAPORE_IP'),
  ('asia-northeast1',    'Japan',          'YOUR_JAPAN_IP'),
  ('australia-southeast1','Australia',     'YOUR_AUSTRALIA_IP'),
  ('europe-west2',       'United Kingdom','YOUR_UK_IP'),
  ('europe-west3',       'Germany',        'YOUR_GERMANY_IP'),
  ('northamerica-northeast1', 'Canada',   'YOUR_CANADA_IP');

  -- Migration: billing tables
-- Run once: psql $DATABASE_URL -f migrations/billing.sql

-- Tracks in-flight M-Pesa STK pushes so the webhook can match them
CREATE TABLE IF NOT EXISTS pending_payments (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id         TEXT    NOT NULL,
  billing_cycle   TEXT    NOT NULL DEFAULT 'monthly',
  provider        TEXT    NOT NULL,              -- 'mpesa' | 'stripe' | 'paypal'
  provider_ref    TEXT    NOT NULL UNIQUE,       -- CheckoutRequestID / session id / order id
  amount          INTEGER NOT NULL,              -- KES or USD cents
  status          TEXT    NOT NULL DEFAULT 'pending', -- pending | success | failed
  failure_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_payments_user   ON pending_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_ref    ON pending_payments(provider_ref);

-- Permanent record of every successful billing event (idempotent via ON CONFLICT)
CREATE TABLE IF NOT EXISTS billing_events (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id      TEXT    NOT NULL,
  payment_ref  TEXT    NOT NULL UNIQUE,          -- receipt / session id — dedup key
  provider     TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'success',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_user ON billing_events(user_id);

-- Add Stripe price IDs to plans table (fill in after creating prices in Stripe dashboard)
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS stripe_price_monthly TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_annual  TEXT,
  ADD COLUMN IF NOT EXISTS price_monthly        INTEGER NOT NULL DEFAULT 0; -- USD, not cents

-- Drop req_total if still present (per earlier cleanup)
ALTER TABLE usage_monthly DROP COLUMN IF EXISTS req_total;