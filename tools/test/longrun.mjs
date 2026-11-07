// Long bot runs (bug hunt): a hero of each class starts on a floor and the dev bot plays the real game for a while
// (fights, loot, stairs, guardians, deaths and respawns). Every error of the page is written down with the floor
// it happened on, and every floor reached with the hero's state.
//   node tools/test/longrun.mjs <out.jsonl> [classes] [start floor] [minutes per hero] [profile] [difficulty]
//   e.g. node tools/test/longrun.mjs /tmp/dw/longrun.jsonl warrior,mage,necro 1 10 median 1
import { appendFileSync } from 'fs';
import { launch, openGame, startGeared, skip, sleep } from './lib.mjs';

const [out = '/tmp/dw/longrun.jsonl', clsArg = 'warrior,assassin,ranger,mage,paladin,necro,berserker,druid,monk,shaman', floorArg = '1', minArg = '8', profile = 'median', difArg = '1'] = process.argv.slice(2);
let { browser, page, errs } = await launch({ width: 844, height: 390, gfx: 0 });

for (const cls of clsArg.split(',')) {
  const t0 = Date.now();
  try {
    await openGame(page);
    await startGeared(page, cls, +floorArg, { quality: profile, difficulty: +difArg });
    await page.evaluate(() => window.__dev.bot(true));
    let seen = 0;
    while (Date.now() - t0 < +minArg * 60000) {
      await sleep(3000);
      // cutscenes and story pages are tapped away like a hurried player would
      await skip(page, 2);
      const st = await page.evaluate(() => {
        const sc = window.__scene;
        return { floor: sc?.floor, village: !!sc?.inVillage, log: window.__dev.botLog().length, dead: !!sc?.player?.dead };
      });
      const log = await page.evaluate((n) => window.__dev.botLog().slice(n), seen);
      seen += log.length;
      for (const l of log) appendFileSync(out, JSON.stringify({ cls, ...l }) + '\n');
      if (errs.length) {
        for (const e of errs.splice(0)) appendFileSync(out, JSON.stringify({ cls, floor: st.floor, error: e.slice(0, 400) }) + '\n');
      }
    }
    const end = await page.evaluate(() => ({ floor: window.__scene?.floor, level: window.__scene?.save.level, deaths: window.__dev.botDeaths?.() }));
    await page.evaluate(() => window.__dev.bot(false));
    appendFileSync(out, JSON.stringify({ cls, done: true, ...end, minutes: Math.round((Date.now() - t0) / 60000) }) + '\n');
    console.log(cls, JSON.stringify(end));
  } catch (e) {
    appendFileSync(out, JSON.stringify({ cls, crash: String(e).slice(0, 300) }) + '\n');
    console.log('crash', cls, String(e).slice(0, 200));
    await browser.close().catch(() => {});
    ({ browser, page, errs } = await launch({ width: 844, height: 390, gfx: 0 }));
  }
}
await browser.close();
