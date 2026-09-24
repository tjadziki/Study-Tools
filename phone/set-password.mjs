// Set the phone app's username and password.
//
// Run it yourself, in your own terminal:   npm run phone:password
//
// The password is typed here, hashed here, and only the hash is sent to
// Vercel. It never appears on screen, in a file, or in anyone's chat log —
// including the assistant that built this.

import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './api/_lib.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Print the prompt, swallow the keystrokes.
      rl._writeToOutput = (s) => {
        if (s.startsWith(question)) rl.output.write(question);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

function vercel(args, input) {
  const r = spawnSync('npx', ['--yes', 'vercel@latest', ...args], {
    cwd: here,
    input,
    stdio: [input == null ? 'inherit' : 'pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    encoding: 'utf8',
  });
  return r;
}

function setEnv(name, value) {
  // Replace, not add: `env add` refuses a name that already exists.
  vercel(['env', 'rm', name, 'production', '--yes']);
  const r = vercel(['env', 'add', name, 'production'], value);
  if (r.status !== 0) {
    console.error(`\nCould not save ${name} to Vercel:\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
}

console.log('\nPhone app sign-in\n');
const username = (await ask('Username: ')).trim().toLowerCase();
if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error('Use 3–32 letters, numbers, dots, dashes or underscores.');
  process.exit(1);
}
const password = await ask('Password (at least 12 characters): ', { hidden: true });
if (password.length < 12) {
  console.error('Too short. Twelve characters or more — a phrase is easiest to remember.');
  process.exit(1);
}
const again = await ask('Password again: ', { hidden: true });
if (again !== password) {
  console.error('Those did not match. Nothing was changed.');
  process.exit(1);
}

process.stdout.write('Hashing… ');
const hash = hashPassword(password);
console.log('done.');

process.stdout.write('Saving to Vercel… ');
setEnv('DECK_USER', username);
setEnv('DECK_PASS_HASH', hash);
console.log('done.');

console.log('Redeploying so it takes effect…\n');
const d = spawnSync(process.execPath, [path.join(here, 'deploy.mjs')], { stdio: 'inherit' });
process.exit(d.status ?? 0);
