// Run the phone app locally — the built page plus the real API handlers —
// with a file standing in for Vercel Blob. For testing the login and sync
// flow end to end without a Vercel account:
//
//   npm run phone:build
//   DECK_USER=... DECK_PASS_HASH=... SESSION_SECRET=... SYNC_TOKEN=... node phone/dev-server.js
//
// Cookies are not marked Secure here, because this is plain http.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, 'dist');
const PORT = Number(process.env.PORT || 5175);
process.env.DECK_DEV_STORE ||= path.join(here, '.dev-snapshot.json');

const ROUTES = {
  '/api/login': 'login.js',
  '/api/logout': 'logout.js',
  '/api/session': 'session.js',
  '/api/snapshot': 'snapshot.js',
};
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const route = ROUTES[url.pathname];
    if (route) {
      try {
        const mod = await import(pathToFileURL(path.join(here, 'api', route)).href);
        return await mod.default(req, res);
      } catch (e) {
        console.error(e);
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: e.message }));
      }
    }
    // Static files, falling back to index.html so client routes resolve.
    let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html');
    }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`  phone (dev)   http://127.0.0.1:${PORT}`);
    console.log(`  snapshot      ${process.env.DECK_DEV_STORE}`);
  });
