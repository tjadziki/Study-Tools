import { config, readSession, send } from './_lib.js';

/** Who is signed in, if anyone. The phone asks this once on launch. */
export default function handler(req, res) {
  const s = readSession(req, config().sessionSecret);
  if (!s) return send(res, 401, { signedIn: false });
  send(res, 200, { signedIn: true, user: s.u });
}
