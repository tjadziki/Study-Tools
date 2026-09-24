import { clearCookie, send, isSecure } from './_lib.js';

export default function handler(req, res) {
  send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie({ secure: isSecure(req) }) });
}
