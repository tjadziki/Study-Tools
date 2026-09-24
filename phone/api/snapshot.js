import { config, readSession, safeEqual, readJson, readSnapshot, writeSnapshot, send } from './_lib.js';

// GET  — the phone, with its session cookie: the latest copy of the deck.
// POST — the laptop, with the sync token: replace that copy.
//
// The phone can only read. Everything that changes the deck happens on the
// laptop, which is the only source of truth.

const MAX_BYTES = 1024 * 1024;

export default async function handler(req, res) {
  const cfg = config();

  if (req.method === 'GET') {
    if (!readSession(req, cfg.sessionSecret)) return send(res, 401, { error: 'Sign in first.' });
    const json = await readSnapshot();
    if (!json) return send(res, 404, { error: 'The laptop has not synced yet. Open the deck on the laptop.' });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(json);
  }

  if (req.method === 'POST') {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!cfg.syncToken || !token || !safeEqual(token, cfg.syncToken)) {
      return send(res, 401, { error: 'Bad sync token.' });
    }
    let body;
    try {
      body = await readJson(req, MAX_BYTES);
    } catch (e) {
      return send(res, e.status || 400, { error: e.message || 'Could not read the snapshot.' });
    }
    // A shape check, not a schema: enough to refuse something that is plainly
    // not a deck before it overwrites the one the phone is reading.
    if (!body || body.v !== 1 || !Array.isArray(body.courses) || !Array.isArray(body.components)) {
      return send(res, 400, { error: 'That is not a deck snapshot.' });
    }
    await writeSnapshot(JSON.stringify(body));
    return send(res, 200, { ok: true, syncedAt: body.syncedAt });
  }

  send(res, 405, { error: 'GET or POST only.' });
}
