// The Google Play feature graphic (1024 × 500): the main menu's living dungeon with the title and the heroes.
//   node tools/test/feature.mjs [out.png] [cs|en]   (the dev build served by tools/serve.sh)
import { launch, openGame, sleep } from './lib.mjs';
const [out = 'store/feature.png', lang = 'cs'] = process.argv.slice(2);
const { browser, page } = await launch({ width: 1024, height: 500, scale: 1, gfx: 3, locale: lang === 'en' ? 'en-US' : 'cs-CZ' });
await openGame(page, { port: process.env.PORT || 4177 });
await sleep(3000);
await page.addStyleTag({ content: `
  .menu .btn, .menu .todayline, .menu .row, .menu .version, .menu .saveinfo { display: none !important; }
  .menu h1 { font-size: 132px !important; margin-top: -40px !important; }
  .menu .subtitle { font-size: 34px !important; margin-top: 6px; }
  .menu .sprites { visibility: visible !important; display: flex !important; bottom: 34px !important; gap: 26px !important; }
  .menu .sprites img { height: 92px !important; animation: none !important; }
` });
await sleep(800);
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
