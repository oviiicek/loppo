import Phaser from 'phaser';
import '@fontsource/jersey-10/latin-ext-400.css';
import '@fontsource/jersey-10/latin-400.css';
import './ui/style.css';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { GalleryScene } from './scenes/GalleryScene';
import { MenuScene } from './scenes/MenuScene';
import { initI18n } from './i18n/i18n';
import { initStore } from './systems/store';
import { isNativeApp } from './systems/platform';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'game',
  backgroundColor: '#07060a',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  input: { activePointers: 4 },
  scene: [BootScene, MenuScene, GameScene, GalleryScene],
};

// the language goes on before anything reaches the screen; the way to pay (and a purchase coming back from the
// payment page) is found meanwhile
void initI18n()
  .catch(() => {})
  .then(() => {
    (window as any).__game = new Phaser.Game(config);
    void initStore().catch(() => {});
  });

if (import.meta.env.DEV || import.meta.env.MODE === 'devtools') import('./dev');
// (not in the app: its files are inside it, and a cache could keep serving an old version after an update)
else if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !isNativeApp()) {
  // offline support when installed as a PWA (silently skipped in sandboxed frames)
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    } catch {
      /* not available here */
    }
  });
}
