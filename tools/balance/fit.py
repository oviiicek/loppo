#!/usr/bin/env python3
"""Suggests the knots of packHpMult (src/data/enemies.ts) and the class powers (CLASS_POWER in src/data/spells.ts)
from damage meter lines (tools/test/dps.mjs) measured with the current values. For every floor: how much tougher
the monsters must be for the median class to need TARGET seconds per pack on normal (the pack's health over the
damage per second); for every class: how much harder its spells must hit to clear like the median class (the
geometric mean over the floors, only the spells' share of its damage can change).
The class powers are worked out first and the floors' toughness after them (from the damage each class would
deal with its new power).
   python3 tools/balance/fit.py <dps.jsonl> [target seconds] [current knots as f:m,f:m,...]"""
import json, sys, math
from collections import defaultdict

def gmean(xs):
    xs = [x for x in xs if x > 0]
    return math.exp(sum(math.log(x) for x in xs) / len(xs)) if xs else 0

rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
rows = [r for r in rows if 'dps' in r and r.get('t', 0) >= 12]
target = float(sys.argv[2]) if len(sys.argv) > 2 else 2.5
cur = {}
if len(sys.argv) > 3:
    for kv in sys.argv[3].split(','):
        f, m = kv.split(':')
        cur[int(f)] = float(m)

def cur_mult(f):
    if not cur:
        return 1.0
    ks = sorted(cur)
    if f <= ks[0]:
        return cur[ks[0]]
    if f >= ks[-1]:
        return cur[ks[-1]]
    for a, b in zip(ks, ks[1:]):
        if a <= f <= b:
            t = (f - a) / (b - a)
            return math.exp(math.log(cur[a]) * (1 - t) + math.log(cur[b]) * t)

def share_of(r):
    # the part of the damage that the class power scales: spells, what they summon, half of the burning
    return (r['split']['spell'] + r['split'].get('ally', 0) + r['split'].get('dot', 0) * 0.5) / max(1, r['dps'])

def table(power):
    t = defaultdict(lambda: defaultdict(list))
    for r in rows:
        k = power.get(r['cls'], 1)
        sh = share_of(r)
        dps = r['dps'] * ((1 - sh) + sh * k)
        t[r['floor']][r['cls']].append(r['packHp'] / max(1, dps))
    return {f: {c: gmean(v) for c, v in t[f].items()} for f in t}

classes = sorted({r['cls'] for r in rows})
shares = {c: sum(share_of(r) for r in rows if r['cls'] == c) / max(1, sum(1 for r in rows if r['cls'] == c)) for c in classes}
med = table({})
floors = sorted(med)
power = {}
print('class   speed vs median (>1 kills faster)   spell share   suggested power ×')
for c in classes:
    ratios = []
    for f in floors:
        if c in med[f] and len(med[f]) >= 3:
            m = sorted(med[f].values())[len(med[f]) // 2]
            ratios.append(m / med[f][c])
    g = gmean(ratios)
    share = shares[c]
    # only the spells' part of the damage scales with the class power: power p makes the speed (1-share) + share*p
    want = 1 / g if g else 1
    p = (want - (1 - share)) / share if share > 0.05 else 1
    p = max(0.25, min(3, p))
    power[c] = p
    print(f'{c:10} {g:8.2f}  ({" ".join(f"{x:.2f}" for x in ratios)})   {share:5.2f}   {p:5.2f}')
adj = table(power)
print('\nwith those powers:')
print('floor  median-class s  ×tougher  new mult   spread (slowest/fastest class)')
for f in floors:
    per = adj[f]
    vals = sorted(per.values())
    m = vals[len(vals) // 2] if vals else 0
    k = target / m if m else 0
    print(f'{f:5}  {m:14.2f}  {k:8.2f}  {k * cur_mult(f):8.2f}   {vals[-1] / vals[0] if vals else 0:6.2f}  ({len(per)} classes)')

# The monsters' damage: how much of the hero's health a pack takes on normal, with the pack lasting TARGET seconds
# (`taken` is the share per second with the whole pack fighting; in a real fight about half of it is still up on
# average). DANGER is the share a pack should take on normal (potions, regeneration and life steal not counted).
DANGER = float(sys.argv[4]) if len(sys.argv) > 4 else 0.45
tk = defaultdict(list)
for r in rows:
    if 'taken' in r:
        tk[r['floor']].append(r['taken'])
if tk:
    print('\nfloor  taken/s (median hero)  share of health per pack  ×damage for %.0f %%' % (DANGER * 100))
    for f in sorted(tk):
        v = sorted(tk[f])[len(tk[f]) // 2]
        per_pack = v * target * 0.55
        print(f'{f:5}  {v:8.3f}  {per_pack:8.2f}  {DANGER / per_pack if per_pack else 0:8.2f}')
