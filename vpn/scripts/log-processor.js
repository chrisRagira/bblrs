/**
 * log-processor.js
 * Tails Squid's access.log, resolves API key → user_id, ships to /api/usage/ingest.
 *
 * Squid native log format (space-separated):
 *   timestamp  duration  client  action/status  bytes  method  url  username  ...
 */

import { createReadStream, statSync, mkdirSync, closeSync, openSync, existsSync } from 'fs'
import { createInterface } from 'readline'
import { watch } from 'fs'

const LOG_FILE    = '/var/log/squid/access.log'
const API_BASE    = process.env.API_URL || 'http://api:4000'
const INGEST_URL  = `${API_BASE}/usage/ingest`
const RESOLVE_URL = `${API_BASE}/resolve-key`
const BATCH_SIZE  = 20
const FLUSH_MS    = 3000
const MAX_BATCH   = 500   // FIX #1: cap batch to prevent unbounded growth on outage

// ── Ensure log file exists ────────────────────────────────────────────────────
mkdirSync('/var/log/squid', { recursive: true })
if (!existsSync(LOG_FILE)) closeSync(openSync(LOG_FILE, 'a'))

// ── Key resolution cache (prefix → {user_id, key_id}) ────────────────────────
const keyCache = new Map()

async function resolveKey(prefix) {
  if (keyCache.has(prefix)) return keyCache.get(prefix)
  try {
    const res = await fetch(`${RESOLVE_URL}?prefix=${encodeURIComponent(prefix)}`, {
      headers: { 'X-Internal-Secret': process.env.INGEST_SECRET || '' },  // add this
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.user_id) {
      keyCache.set(prefix, data)
      setTimeout(() => keyCache.delete(prefix), 300_000)
      return data
    }
  } catch { /* API not ready yet */ }
  return null
}

// ── Parse a Squid native log line ─────────────────────────────────────────────
function parseLine(line) {
  const parts = line.trim().split(/\s+/)
  if (parts.length < 8) return null

  const [timestamp, duration, , actionStatus, bytes, method, url, username] = parts
  if (!username || username === '-') return null

  const [, statusCode] = actionStatus.split('/')
  return {
    timestamp,
    username,                          // the API key (full key sent as username)
    bytes_recv: parseInt(bytes) || 0,
    bytes_sent: 0,
    target_host: extractHost(url),
    status_code: parseInt(statusCode) || 0,
    method,
  }
}

function extractHost(url) {
  if (!url || url === '-') return null
  try {
    const u = url.includes('://') ? url : `http://${url}`
    return new URL(u).hostname
  } catch {
    return url.split(':')[0]
  }
}

// ── Batch + flush ─────────────────────────────────────────────────────────────
let batch = []
let flushFailures = 0

async function processLine(line) {
  const entry = parseLine(line)
  if (!entry) return

  // FIX #1: drop new entries when batch is at capacity (outage protection)
  if (batch.length >= MAX_BATCH) {
    console.warn(`Batch at capacity (${MAX_BATCH}), dropping entry`)
    return
  }

  const prefix = entry.username.slice(0, 8)
  const resolved = await resolveKey(prefix)
  if (!resolved) return

  batch.push({
    user_id:     resolved.user_id,
    api_key_id:  resolved.key_id,
    bytes_recv:  entry.bytes_recv,
    bytes_sent:  entry.bytes_sent,
    target_host: entry.target_host,
    status_code: entry.status_code,
  })

  if (batch.length >= BATCH_SIZE) await flush()
}

async function flush() {
  if (!batch.length) return
  const items = batch.splice(0)
  try {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Internal-Secret': process.env.INGEST_SECRET || '',  // FIX #7 (client side)
      },
      body: JSON.stringify({ entries: items }),  // FIX #6: send as { entries: [...] }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    flushFailures = 0
  } catch (e) {
    flushFailures++
    console.error(`Ingest error (failure #${flushFailures}):`, e.message)
    // FIX #1: only retry if we have headroom; otherwise drop to prevent growth
    const headroom = MAX_BATCH - batch.length
    if (headroom > 0) {
      batch.unshift(...items.slice(0, headroom))
      if (items.length > headroom) {
        console.warn(`Dropped ${items.length - headroom} entries (batch full)`)
      }
    } else {
      console.warn(`Dropped ${items.length} entries (batch at capacity)`)
    }
  }
}

// ── Tail the log file ─────────────────────────────────────────────────────────
let lastSize = statSync(LOG_FILE).size
let lastIno  = statSync(LOG_FILE).ino   // FIX #2: track inode for rotation detection

function tail() {
  const stat = statSync(LOG_FILE)

  // FIX #2: detect log rotation — inode changed or file shrank
  if (stat.ino !== lastIno || stat.size < lastSize) {
    console.log('Log rotation detected, resetting offset')
    lastSize = 0
    lastIno  = stat.ino
  }

  if (stat.size <= lastSize) return  // no new data

  const stream = createReadStream(LOG_FILE, { start: lastSize, end: stat.size })
  const rl = createInterface({ input: stream })
  rl.on('line', line => processLine(line))
  rl.on('close', () => { lastSize = stat.size })
}

// FIX #3: only tail on 'change' events, not renames/metadata
watch(LOG_FILE, (eventType) => {
  if (eventType === 'change') tail()
})

setInterval(flush, FLUSH_MS)

console.log(`Log processor watching ${LOG_FILE} → ${INGEST_URL}`)