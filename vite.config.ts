import { defineConfig } from 'vite';

// The app is deployed to beattheslide.com/app/ — the landing page owns the root.
// Relative base keeps it portable if that ever changes.
// Sourcemaps in dev only. `/app` is a public bundle: shipping maps would expose
// the full TypeScript source, and generating-then-deleting them (the old deploy
// step) left a dangling sourceMappingURL that sends devtools chasing a 404.
export default defineConfig(({ command }) => ({
  base: './',
  build: { outDir: 'dist', sourcemap: command === 'serve' },
  server: { port: 5173, open: false },
}));
