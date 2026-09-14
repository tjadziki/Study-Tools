import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const API_PORT = process.env.DECK_PORT || 5174;

export default defineConfig({
  root: here,
  plugins: [react()],
  server: {
    port: Number(process.env.DECK_CLIENT_PORT || 5173),
    strictPort: false,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: path.resolve(here, '../dist'),
    emptyOutDir: true,
  },
});
