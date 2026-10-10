import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  // the version shown in the corner of the main menu
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2500,
    // small assets (the pixel font) are inlined so the game works from any static host or sandbox
    assetsInlineLimit: 20000,
  },
});
