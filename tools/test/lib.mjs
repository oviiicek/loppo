// Shared helpers for the browser tests (Playwright). The game must be served first (see tools/serve.sh):
// the dev build (with window.__dev) on port 4177, the release build on 4181.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

export const PORT = process.env.PORT || '4177';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** a browser with one page; errors of the page are collected in `errs`. `gfx` sets the game's graphics level
 *  (0 – 3) before every load: the long measurements use 0, which costs the least time */
export async function launch({ locale = 'cs-CZ', width = 844, height = 390, scale = 1, touch = false, gfx = null } = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, locale, hasTouch: touch });
  if (gfx !== null)
    await ctx.addInitScript((g) => {
      try {
        const s = JSON.parse(localStorage.getItem('loppo-settings') || '{}');
        s.gfx = g;
        s.lowFx = g <= 1;
        localStorage.setItem('loppo-settings', JSON.stringify(s));
      } catch {}
    }, gfx);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push('CONSOLE ' + m.text());
  });
  return { browser, ctx, page, errs };
}

/** the game's main menu is up (and the dev tools with it, on the dev build) */
export async function openGame(page, { port = PORT, dev = true, clear = true } = {}) {
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction((d) => (!d || window.__dev) && document.querySelector('.menu'), dev, { timeout: 60000 });
  if (clear) await page.evaluate(() => localStorage.clear());
}

/** cutscenes and title cards tapped away */
export async function skip(page, n = 12) {
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => window.__dev?.skipCutscene()).catch(() => {});
    await sleep(200);
  }
}

/** a hero of a class geared for a floor ('good': strong gear, 'median': a typical player's) on a difficulty
 *  (index into DIFFICULTIES); the floor is playable when this returns */
export async function startGeared(page, cls, floor, { quality = 'median', difficulty = 1, story = true } = {}) {
  const info = await page.evaluate(([c, f, s, q, d]) => window.__dev.startGeared(c, f, s, q, d), [cls, floor, story, quality, difficulty]);
  await sleep(1500);
  await skip(page);
  await page.waitForFunction(() => window.__scene && !window.__scene.cinematic, null, { timeout: 60000 });
  return info;
}

/** waits until the scene answers true (polled), or the time is up */
export async function until(page, fn, arg, ms = 30000) {
  return page.waitForFunction(fn, arg, { timeout: ms, polling: 250 }).then(
    () => true,
    () => false,
  );
}

/** what the toasts say right now */
export const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('.toasts > *')].map((t) => t.textContent));

/** prints a line as JSON (the tests' output is read by people and by other scripts) */
export const log = (label, v) => console.log(label, JSON.stringify(v));
