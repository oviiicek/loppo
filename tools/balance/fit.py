#!/usr/bin/env python3
"""Suggests the knots of packHpMult (src/data/enemies.ts) and the class powers (CLASS_POWER in src/data/spells.ts)
from damage meter lines (tools/test/dps.mjs) measured with the current values. For every floor: how much tougher
the monsters must be for the median class to need TARGET seconds per pack on normal (the pack's health over the
damage per second); for every class: how much harder its spells must hit to clear like the median class (the
geometric mean over the floors, only the spells' share of its damage can change).
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

t = defaultdict(lambda: defaultdict(list))
spell_share = defaultdict(list)
for r in rows:
    t[r['floor']][r['cls']].append(r['packHp'] / max(1, r['dps']))
    spell_share[r['cls']].append((r['split']['spell'] + r['split'].get('ally', 0) + r['split'].get('dot', 0) * 0.5) / max(1, r['dps']))
floors = sorted(t)
classes = sorted({r['cls'] for r in rows})
print('floor  median-class s  ×tougher  new mult')
med = {}
for f in floors:
    per = {c: gmean(v) for c, v in t[f].items()}
    m = sorted(per.values())[len(per) // 2] if per else 0
    med[f] = per
    k = target / m if m else 0
    print(f'{f:5}  {m:14.2f}  {k:8.2f}  {k * cur_mult(f):8.2f}   ({len(per)} classes)')
print('\nclass   speed vs median (>1 kills faster)   spell share   suggested power ×')
for c in classes:
    ratios = []
    for f in floors:
        if c in med[f] and len(med[f]) >= 3:
            m = sorted(med[f].values())[len(med[f]) // 2]
            ratios.append(m / med[f][c])
    g = gmean(ratios)
    share = sum(spell_share[c]) / len(spell_share[c])
    # only the spells' part of the damage scales with the class power: power p makes the speed (1-share) + share*p
    want = 1 / g if g else 1
    p = (want - (1 - share)) / share if share > 0.05 else 1
    p = max(0.25, min(3, p))
    print(f'{c:10} {g:8.2f}  ({" ".join(f"{x:.2f}" for x in ratios)})   {share:5.2f}   {p:5.2f}')
