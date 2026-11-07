// The newcomer's pack offered after a hero's first guardian (dev build: the test store is open): it shows once,
// with the time left, and "Teď ne" closes it for good.
//   node tools/test/nudge.mjs [out dir]
import { launch, openGame, startGeared, skip, until, log, sleep } from './lib.mjs';

const out = process.argv[2] || '/tmp/dw/shots';
const { browser, page, errs } = await launch({ width: 844, height: 390, gfx: 0 });
await openGame(page);
await startGeared(page, 'warrior', 10, { quality: 'good' });
log('born', await until(page, () => !!window.__scene.save.pearl?.born, null, 40000));
await page.evaluate(() => {
  window.__noCap = true;
  window.__scene.godMode = true;
  window.__dev.toBoss();
});
await sleep(1500);
await skip(page, 8);
let boss = null;
for (let i = 0; i < 40 && !boss?.dead; i++) {
  boss = await page.evaluate(() => window.__dev.hitBoss(0.5));
  await sleep(400);
}
log('guardian down', !!boss?.dead);
await until(page, () => !!document.querySelector('.nudge'), null, 15000);
await skip(page, 4);
log('offer', await page.evaluate(() => document.querySelector('.nudge')?.textContent?.replace(/\s+/g, ' ').trim()));
await page.screenshot({ path: `${out}/nudge.png` });
await page.evaluate(() => document.querySelector('.nudge [data-x=no]')?.click());
await sleep(300);
const again = await page.evaluate(() => {
  window.__scene.ui.pearls.starterNudge();
  return !!document.querySelector('.nudge');
});
log('once', { again, flag: await page.evaluate(() => window.__scene.save.pearl?.nudged) });
log('errors', errs);
await browser.close();
