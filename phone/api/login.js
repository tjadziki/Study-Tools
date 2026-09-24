import {
  config, verifyPassword, safeEqual, makeSession, sessionCookie, readJson, send, isSecure,
  clientIp, throttled, noteFailure, clearFailures,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only.' });
  const cfg = config();
  if (!cfg.user || !cfg.passHash || !cfg.sessionSecret) {
    return send(res, 503, { error: 'Login is not set up yet. Run npm run phone:password on the laptop.' });
  }

  const ip = clientIp(req);
  if (throttled(ip)) {
    return send(res, 429, { error: 'Too many wrong attempts. Wait fifteen minutes and try again.' });
  }

  let body;
  try {
    body = await readJson(req, 4096);
  } catch {
    return send(res, 400, { error: 'Could not read that.' });
  }

  // Check both, always, so a wrong username costs the same time as a wrong
  // password and the response does not say which one was wrong.
  const userOk = safeEqual(String(body.username || '').trim().toLowerCase(), cfg.user.toLowerCase());
  const passOk = verifyPassword(String(body.password || ''), cfg.passHash);

  if (!(userOk && passOk)) {
    noteFailure(ip);
    await new Promise((r) => setTimeout(r, 400));
    return send(res, 401, { error: 'That username and password do not match.' });
  }

  clearFailures(ip);
  send(res, 200, { ok: true, user: cfg.user }, {
    'Set-Cookie': sessionCookie(makeSession(cfg.user, cfg.sessionSecret), { secure: isSecure(req) }),
  });
}
