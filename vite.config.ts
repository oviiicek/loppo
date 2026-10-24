import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  // the game's name (the title of the main menu and the page) and the version shown in the menu's corner
  define: { __APP_NAME__: JSON.stringify(pkg.productName), __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [{ name: 'app-name', transformIndexHtml: (html) => html.replaceAll('%APP_NAME_UPPER%', pkg.productName.toUpperCase()).replaceAll('%APP_NAME%', pkg.productName) }],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2500,
    // small assets (the pixel font) are inlined so the game works from any static host or sandbox
    assetsInlineLimit: 20000,
  },
});
