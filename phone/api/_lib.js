// Shared server code for the phone app's API. The leading underscore keeps
// Vercel from deploying this file as a route of its own.
//
// Written against plain Node (req/res), not Vercel's helpers, so the same
// handlers run unchanged in dev-server.js for local testing.

import crypto from 'node:crypto';

/* ── config ─────────────────────────────────────────────────────────────── */

const env = (k) => process.env[k] || '';

export function config() {
  return {
    user: env('DECK_USER'),
    passHash: env('DECK_PASS_HASH'),
    sessionSecret: env('SESSION_SECRET'),
    syncToken: env('SYNC_TOKEN'),
  };
}

/* ── passwords ──────────────────────────────────────────────────────────────
   scrypt, with its cost baked into the stored string so it can be raised
   later without invalidating an old hash:  scrypt$N$r$p$salt$hash
   ────────────────────────────────────────────────────────────────────────── */

export function hashPassword(password, { N = 2 ** 15, r = 8, p = 1 } = {}) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', N, r, p, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64url');
  let actual;
  try {
    actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64url'), expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/**
 * Constant-time string comparison, for the username and the sync token.
 * Hashing first gives both sides the same length, which timingSafeEqual
 * requires, without leaking the real length through an early return.
 */
export function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

/* ── sessions ───────────────────────────────────────────────────────────────
   A signed cookie, not a session table: payload.hmac, where the payload says
   who and until when. Nothing to store, and a changed SESSION_SECRET logs
   every phone out at once.
   ────────────────────────────────────────────────────────────────────────── */

const COOKIE = 'deck_session';
export const SESSION_DAYS = 60;

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function makeSession(user, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ u: user, exp: now + SESSION_DAYS * 86400000 })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function readSession(req, secret, now = Date.now()) {
  if (!secret) return null;
  const raw = parseCookies(req.headers.cookie || '')[COOKIE];
  if (!raw) return null;
  const [payload, mac] = raw.split('.');
  if (!payload || !mac) return null;
  const good = sign(payload, secret);
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return s && s.exp > now ? s : null;
  } catch {
    return null;
  }
}

export function sessionCookie(value, { secure = true } = {}) {
  return [
    `${COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : null,
    `Max-Age=${SESSION_DAYS * 86400}`,
  ]
    .filter(Boolean)
    .join('; ');
}

export function clearCookie({ secure = true } = {}) {
  return [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', secure ? 'Secure' : null, 'Max-Age=0']
    .filter(Boolean)
    .join('; ');
}

function parseCookies(header) {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/* ── login throttling ───────────────────────────────────────────────────────
   Best effort, per warm instance: a burst of failures from one address gets
   slowed right down. It is not the real defence — that is scrypt making each
   guess expensive, and a password long enough that guessing is hopeless —
   but it stops a script from hammering the endpoint for free.
   ────────────────────────────────────────────────────────────────────────── */

const failures = new Map(); // ip -> { count, first }
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;

export function throttled(ip, now = Date.now()) {
  const f = failures.get(ip);
  if (!f) return false;
  if (now - f.first > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return f.count >= MAX_FAILS;
}

export function noteFailure(ip, now = Date.now()) {
  const f = failures.get(ip);
  if (!f || now - f.first > WINDOW_MS) failures.set(ip, { count: 1, first: now });
  else f.count += 1;
}

export function clearFailures(ip) {
  failures.delete(ip);
}

export function clientIp(req) {
  return String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .split(',')[0]
    .trim();
}

/* ── the snapshot store ─────────────────────────────────────────────────────
   Private Vercel Blob in production: one JSON file, overwritten on every
   sync, read back with the CDN cache bypassed so the phone never sees a stale
   copy. A local file in development, so the whole flow can be tested
   without an account.
   ────────────────────────────────────────────────────────────────────────── */

const SNAPSHOT = 'deck/snapshot.json';

export async function writeSnapshot(json) {
  if (process.env.DECK_DEV_STORE) {
    const fs = await import('node:fs/promises');
    await fs.writeFile(process.env.DECK_DEV_STORE, json, 'utf8');
    return;
  }
  const { put } = await import('@vercel/blob');
  await put(SNAPSHOT, json, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
}

export async function readSnapshot() {
  if (process.env.DECK_DEV_STORE) {
    const fs = await import('node:fs/promises');
    try {
      return await fs.readFile(process.env.DECK_DEV_STORE, 'utf8');
    } catch {
      return null;
    }
  }
  const { get } = await import('@vercel/blob');
  try {
    // null when the file does not exist yet; a stream only on a 200.
    const res = await get(SNAPSHOT, { access: 'private', useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return await new Response(res.stream).text();
  } catch (e) {
    if (/not.?found/i.test(String(e?.message || e?.name))) return null;
    throw e;
  }
}

/* ── tiny request helpers ───────────────────────────────────────────────── */

export async function readJson(req, limit = 512 * 1024) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('Body too large.'), { status: 413 });
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export const isSecure = (req) =>
  String(req.headers['x-forwarded-proto'] || '').includes('https') || process.env.VERCEL === '1';
