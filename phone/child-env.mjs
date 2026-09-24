// An environment the Vercel CLI can actually use on Windows.
//
// Windows treats environment names case-insensitively, and some terminals
// (PowerShell among them) hand processes their search path as `Path`. Node
// hides that — process.env.PATH still works — until a tool copies the
// environment into a plain object and reads `.PATH` from the copy. The Vercel
// CLI does exactly that when it runs the build command: it finds no PATH,
// builds one containing only its own folders, and then cannot find cmd.exe
// ("Error: spawn cmd.exe ENOENT"). The same deploy works from a terminal
// that happens to spell it `PATH`.
//
// So every child process gets the search path under one uppercase key, with
// System32 on it, and an explicit ComSpec.

import path from 'node:path';

export function childEnv() {
  const env = { ...process.env };
  if (process.platform !== 'win32') return env;

  const root = env.SystemRoot || env.SYSTEMROOT || env.windir || 'C:\\Windows';
  const system32 = path.join(root, 'System32');

  const pathKeys = Object.keys(env).filter((k) => k.toUpperCase() === 'PATH');
  const value = pathKeys.map((k) => env[k]).filter(Boolean).join(path.delimiter);
  for (const k of pathKeys) delete env[k];
  env.PATH = value.toLowerCase().includes(system32.toLowerCase()) ? value : [system32, value].filter(Boolean).join(path.delimiter);

  const comKeys = Object.keys(env).filter((k) => k.toUpperCase() === 'COMSPEC');
  const comspec = comKeys.map((k) => env[k]).find(Boolean) || path.join(system32, 'cmd.exe');
  for (const k of comKeys) delete env[k];
  env.ComSpec = comspec;

  return env;
}
