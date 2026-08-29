import { defineConfig } from 'vite';

// Deployed to GitHub Pages under a repo subpath unless a custom domain is used.
// beattheslide.com serves the hub, so the app will live at its own base later.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: true },
  server: { port: 5173, open: false },
});
