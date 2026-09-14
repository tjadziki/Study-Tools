import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  // Absolute, because vite is launched from the repo root and relative globs
  // would resolve against the wrong directory.
  content: [path.join(here, 'index.html'), path.join(here, 'src/**/*.{js,jsx}')],
  theme: {
    extend: {
      colors: {
        bg: '#151f29',
        surface: '#1b2837',
        ink: '#eef3f8',
        accent: '#94bce3',
        sig: '#e2913f',
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        heading: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        body: ['Barlow', 'system-ui', 'sans-serif'],
      },
    },
  },
  // The ported mockup keeps its inline styles verbatim so the design survives
  // the port unchanged. Tailwind's reset would fight them, so it is off.
  corePlugins: { preflight: false },
  plugins: [],
};
