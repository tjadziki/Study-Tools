// Build the phone app here and ship it to Vercel as a prebuilt deployment.
//
//   npm run phone:deploy
//
// Built locally rather than on Vercel because the phone app imports the
// laptop's own ranking and planning code from ../client/src — code that lives
// outside phone/, and so would not exist on Vercel's build machines. Sharing
// that code is the point: the phone cannot rank differently from the laptop.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function vercel(args) {
  const r = spawnSync('npx', ['--yes', 'vercel@latest', ...args], {
    cwd: here,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

vercel(['pull', '--yes', '--environment=production']);
vercel(['build', '--prod']);
vercel(['deploy', '--prebuilt', '--prod']);
