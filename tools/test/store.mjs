// The shop for real money on the dev build (it pretends to pay): the packs with the first purchase doubled, the
// newcomer's pack, the month of pearls and its daily pearls, the deal of the day, the shortfall dialog, trying a
// look on, and the rise from the ashes on the death screen.
//   node tools/test/store.mjs [out dir]
import { launch, openGame, startGeared, until, toasts, log, sleep } from './lib.mjs';

const out = process.argv[2] || '/tmp/dw/shots';
const { browser, page, errs } = await launch();
const shot = (n) => page.screenshot({ path: `${out}/store_${n}.png` });
const st = () => page.evaluate(() => ({ pearls: window.__scene.save.pearls, buys: window.__scene.save.pearl?.buys, phoenix: window.__scene.save.pearl?.phoenix, auras: window.__scene.save.pearl?.auras, titles: window.__scene.save.pearl?.titles, month: window.__scene.save.pearl?.month }));
await openGame(page);
await startGeared(page, 'paladin', 20, { quality: 'good' });
// the gift of the day marks the hero's first day (the newcomer's pack counts its week from it)
log('gift', { ok: await until(page, () => !!window.__scene.save.pearl?.born, null, 40000) });
await page.evaluate(() => window.__scene.ui.pearls.open('get'));
await sleep(500);
await shot('get');
log('kind', await page.evaluate(() => document.querySelector('.pearlpanel .body .hint:last-of-type')?.textContent?.slice(0, 120)));
// the first pack: twice the pearls
const p0 = (await st()).pearls ?? 0;
await page.evaluate(() => document.querySelector('[data-pay=pearls_130]')?.click());
await sleep(1200);
const a = await st();
log('first pack', { got: (a.pearls ?? 0) - p0, ok: (a.pearls ?? 0) - p0 === 250, buys: a.buys, heart: a.titles?.includes('heart') });
// the second pack: no doubling
await page.evaluate(() => document.querySelector('[data-pay=pearls_50]')?.click());
await sleep(1200);
const b = await st();
log('second pack', { got: (b.pearls ?? 0) - (a.pearls ?? 0), ok: (b.pearls ?? 0) - (a.pearls ?? 0) === 50 });
// the newcomer's pack once
await page.evaluate(() => document.querySelector('[data-pay=starter]')?.click());
await sleep(1200);
const c = await st();
log('starter', { got: (c.pearls ?? 0) - (b.pearls ?? 0), phoenix: c.phoenix, ember: c.auras?.includes('ember'), offered: await page.evaluate(() => !!document.querySelector('[data-pay=starter]')) });
// the month of pearls: 30 now, then 5 a day (today's taken right after)
await page.evaluate(() => document.querySelector('[data-pay=month]')?.click());
await sleep(1200);
const d = await st();
log('month', { got: (d.pearls ?? 0) - (c.pearls ?? 0), month: d.month });
await shot('after');
// the deal of the day (in the shop) and a dialog when pearls are short
await page.evaluate(() => document.querySelector('.tab[data-tab=shop]').click());
await sleep(400);
await shot('shop');
const dealBefore = await page.evaluate(() => ({ text: document.querySelector('.deal b')?.textContent, price: document.querySelector('[data-a=deal]')?.textContent }));
await page.evaluate(() => document.querySelector('[data-a=deal]')?.click());
await sleep(600);
log('deal', { ...dealBefore, sold: await page.evaluate(() => !!document.querySelector('.deal.sold')), toast: (await toasts(page)).slice(-1)[0] });
await page.evaluate(() => (window.__scene.save.pearls = 3));
await page.evaluate(() => window.__scene.ui.pearls.refresh());
await sleep(300);
await page.evaluate(() => document.querySelector('[data-buy=chest]')?.click());
await sleep(400);
log('shortfall', await page.evaluate(() => document.querySelector('.shortfall')?.textContent.replace(/\s+/g, ' ').slice(0, 160)));
await shot('shortfall');
await page.evaluate(() => document.querySelector('.shortfall [data-x=get]')?.click());
await sleep(400);
log('to get tab', await page.evaluate(() => document.querySelector('.pearlpanel .tab.on')?.dataset.tab));
// trying a look on
await page.evaluate(() => document.querySelector('.tab[data-tab=looks]').click());
await sleep(300);
await page.evaluate(() => document.querySelector('[data-try="aura:holy"]')?.click());
await sleep(800);
log('try on', await page.evaluate(() => ({ trying: window.__scene.save.pearl.trying?.id, panel: !!document.querySelector('.pearlpanel') })));
await shot('tryon');
// the death screen: rise from the ashes for pearls
await page.evaluate(() => {
  const sc = window.__scene;
  sc.save.pearls = 40;
  sc.save.pearl.phoenix = 0;
  sc.player.hp = 0;
  sc.onPlayerDeath();
});
await until(page, () => !!document.querySelector('[data-a=revive]'), null, 15000);
await shot('death');
const g0 = await page.evaluate(() => window.__scene.save.gold);
await page.evaluate(() => document.querySelector('[data-a=revive]').click());
await sleep(1200);
log('revive', await page.evaluate((g) => ({ dead: window.__scene.player.dead, hp: Math.round(window.__scene.player.hp / window.__scene.player.d.maxHp * 100), pearls: window.__scene.save.pearls, goldKept: window.__scene.save.gold === g, overlay: !!document.querySelector('.overlay') }), g0));
// short of pearls on the death screen: the pearls' panel opens over it and the screen comes back
await page.evaluate(() => {
  const sc = window.__scene;
  sc.save.pearls = 3;
  sc.player.invulnT = 0;
  sc.player.hp = 0;
  sc.onPlayerDeath();
});
await until(page, () => !!document.querySelector('[data-a=revive]'), null, 15000);
await page.evaluate(() => document.querySelector('[data-a=revive]').click());
await sleep(300);
await page.evaluate(() => document.querySelector('.shortfall [data-x=get]')?.click());
await sleep(500);
await page.evaluate(() => document.querySelector('.pearlpanel .close')?.click());
await sleep(400);
log('death screen back', await page.evaluate(() => !!document.querySelector('[data-a=retry]') && getComputedStyle(document.querySelector('[data-a=retry]').closest('.overlay')).display !== 'none'));
log('errors', errs.slice(0, 8));
await browser.close();
