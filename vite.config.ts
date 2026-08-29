import { defineConfig } from 'vite';

// The app is deployed to beattheslide.com/app/ — the landing page owns the root.
// Relative base keeps it portable if that ever changes.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: true },
  server: { port: 5173, open: false },
});
