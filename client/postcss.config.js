import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default {
  plugins: {
    // Vite is launched from the repo root, so Tailwind must be told where its
    // config lives; otherwise it finds none and emits no utility classes.
    tailwindcss: { config: path.join(here, 'tailwind.config.js') },
    autoprefixer: {},
  },
};
