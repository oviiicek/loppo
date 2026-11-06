import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  // the game's name (the title of the main menu and the page), the version shown in the menu's corner, the
  // address a shared result points to, and the payment server of the web version with its public key (see
  // server/README.md; empty: nothing can be bought on the web)
  define: { __APP_NAME__: JSON.stringify(pkg.productName), __APP_VERSION__: JSON.stringify(pkg.version), __APP_URL__: JSON.stringify(pkg.homepage), __STORE__: JSON.stringify(pkg.store ?? { api: '', publicKey: null }) },
  plugins: [{ name: 'app-name', transformIndexHtml: (html) => html.replaceAll('%APP_NAME_UPPER%', pkg.productName.toUpperCase()).replaceAll('%APP_NAME%', pkg.productName).replaceAll('%APP_URL%', pkg.homepage) }],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2500,
    // small assets (the pixel font) are inlined so the game works from any static host or sandbox
    assetsInlineLimit: 20000,
  },
});
