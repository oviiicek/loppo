import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2500,
    // small assets (the pixel font) are inlined so the game works from any static host or sandbox
    assetsInlineLimit: 20000,
  },
});
