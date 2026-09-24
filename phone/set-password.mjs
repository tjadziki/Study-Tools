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
import { childEnv } from './child-env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Read a line without echoing it. Raw mode, one keystroke at a time: the
 * readline trick of muting its output reprints the prompt on every key in
 * some terminals.
 */
function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    let value = '';
    const done = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      process.stdout.write('\n');
      resolve(value);
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') return done(); // Enter, Ctrl+D
        if (ch === '\u0003') {
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130); // Ctrl+C
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1); // Backspace
        else if (ch >= ' ') value += ch;
      }
    };
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    stdin.on('data', onData);
  });
}

function vercel(args, input) {
  const r = spawnSync('npx', ['--yes', 'vercel@latest', ...args], {
    cwd: here,
    input,
    stdio: [input == null ? 'inherit' : 'pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    encoding: 'utf8',
    env: childEnv(),
  });
  return r;
}

function setEnv(name, value) {
  // --force replaces an existing value; --sensitive makes it write-only, so
  // not even the Vercel dashboard can show it back.
  const r = vercel(['env', 'add', name, 'production', '--sensitive', '--force', '--yes'], value);
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
const password = await askHidden('Password (at least 12 characters): ');
if (password.length < 12) {
  console.error('Too short. Twelve characters or more — a phrase is easiest to remember.');
  process.exit(1);
}
const again = await askHidden('Password again: ');
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
const d = spawnSync(process.execPath, [path.join(here, 'deploy.mjs')], { stdio: 'inherit', env: childEnv() });
process.exit(d.status ?? 0);
