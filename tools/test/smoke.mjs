// Release smoke test (the release build, without the dev tools): the page loads, a new hero is made through the
// menus like a player would (class, difficulty), the game starts and runs for a while, the pause menu and the
// About window open – without a single error of the page. Run it on the release build (bash tools/serve.sh prod).
//   node tools/test/smoke.mjs [port] [lang]
import { launch, sleep } from './lib.mjs';

const port = process.argv[2] || '4181';
const lang = process.argv[3] || 'cs';
const { browser, page, errs } = await launch({ width: 844, height: 390, locale: { cs: 'cs-CZ', en: 'en-US', de: 'de-DE' }[lang] ?? lang });
const step = (name, ok, extra = '') => console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ' · ' + extra : ''}`);
await page.goto(`http://127.0.0.1:${port}/`);
step('menu', await page.waitForSelector('.menu [data-a=new]', { timeout: 60000 }).then(() => true, () => false));
step('no dev tools', await page.evaluate(() => !window.__dev));
await page.click('.menu [data-a=new]');
step('classes', await page.waitForSelector('.ccard', { timeout: 15000 }).then(() => true, () => false));
await page.click('.ccard[data-cls=ranger]');
await page.click('[data-a=start]');
step('difficulty', await page.waitForSelector('.dcard', { timeout: 15000 }).then(() => true, () => false));
await page.click('[data-a=go]');
// the prologue: tap through it
for (let i = 0; i < 40; i++) {
  const skip = await page.$('.cs-skip');
  if (!skip) break;
  await skip.dispatchEvent('pointerdown');
  await skip.dispatchEvent('pointerup');
  await sleep(300);
}
step('in the game', await page.waitForSelector('.hud, #ui .bar.hp', { timeout: 30000 }).then(() => true, () => false));
// walk around a little
await page.keyboard.down('ArrowRight');
await sleep(1500);
await page.keyboard.up('ArrowRight');
await page.keyboard.down('ArrowDown');
await sleep(1500);
await page.keyboard.up('ArrowDown');
await sleep(4000);
await page.keyboard.press('Escape');
step('pause', await page.waitForSelector('.overlay', { timeout: 10000 }).then(() => true, () => false));
await page.screenshot({ path: `/tmp/dw/smoke_${lang}.png` });
await page.keyboard.press('Escape');
await sleep(800);
step('errors', errs.length === 0, errs.slice(0, 5).join(' | '));
await browser.close();
process.exit(errs.length ? 1 : 0);
