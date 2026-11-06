// The numbers behind a fight on each floor, without playing it (see __dev.balanceTable): for each class and
// difficulty, how many blows a typical monster takes and how many the hero does. Each row is the median of
// several heroes (their gear is random).
//   node tools/test/table.mjs [classes] [profile] [difficulties] [floors] [heroes]
//   e.g. node tools/test/table.mjs warrior,mage median 0,1,2,3 3,15,35,60,100 7
import { launch, openGame } from './lib.mjs';

const classes = (process.argv[2] || 'warrior,mage,ranger,necro').split(',');
const profile = process.argv[3] || 'median';
const difs = (process.argv[4] || '0,1,2,3').split(',').map(Number);
const floors = (process.argv[5] || '3,15,35,60,100,150,200,245').split(',').map(Number);
const heroes = +(process.argv[6] || 7);
const { browser, page, errs } = await launch();
await openGame(page);
const cols = ['floor', 'lv', 'hp', 'arm', 'wHit', 'aps', 'spell', 'aoe', 'mHp', 'hitsW', 'hitsS', 'hitsA', 'ttk', 'mHit', 'die', 'ttd6'];
const med = (a) => {
  const v = a.filter((x) => typeof x === 'number' && !isNaN(x)).sort((x, y) => x - y);
  return v.length ? v[Math.floor(v.length / 2)] : '-';
};
const out = [];
for (const cls of classes) {
  for (const dif of difs) {
    const runs = [];
    for (let i = 0; i < heroes; i++) runs.push(await page.evaluate(([c, p, d, f]) => window.__dev.balanceTable(c, p, d, f, 2), [cls, profile, dif, floors]));
    const rows = floors.map((_, j) => Object.fromEntries(cols.map((c) => [c, med(runs.map((r) => r[j][c]))])));
    out.push({ cls, dif, profile, rows });
    console.log(`\n${cls} ${profile} difficulty ${dif}`);
    console.log(cols.map((c) => c.padStart(8)).join(''));
    for (const r of rows) console.log(cols.map((c) => String(r[c]).padStart(8)).join(''));
  }
}
if (process.env.JSON) (await import('fs')).writeFileSync(process.env.JSON, JSON.stringify(out));
if (errs.length) console.log(errs.join('\n'));
await browser.close();
