import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The iPhone app: a second entry point that shares the desktop's ranking and
// planning code (src/lib) and its ui/ components, built into phone/dist for
// Vercel. Sharing the code is the point — the phone can never rank or plan
// differently from the laptop, because it is the same code.
const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(here, 'phone'),
  publicDir: path.resolve(here, 'phone/public'),
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(here, 'src') },
    // phone/ has its own node_modules; one copy of React for everything.
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5176,
    proxy: { '/api': 'http://127.0.0.1:5175' },
  },
  build: {
    outDir: path.resolve(here, '../phone/dist'),
    emptyOutDir: true,
  },
});
