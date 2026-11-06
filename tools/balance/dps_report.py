#!/usr/bin/env python3
"""Reads the damage meter's lines (tools/test/dps.mjs) and prints, for each class and floor, the pack's damage per
second (median of the heroes), the pack's health on normal and how long the pack would last (its health over the
damage). The last rows say how much tougher the monsters of each floor would have to be for the median class to
need TARGET seconds per pack.
   python3 tools/balance/dps_report.py <dps.jsonl> [target seconds]"""
import json, sys, math, statistics as st

def gmean(xs):
    xs = [x for x in xs if x > 0]
    return math.exp(sum(math.log(x) for x in xs) / len(xs)) if xs else 0
from collections import defaultdict
path = sys.argv[1]
target = float(sys.argv[2]) if len(sys.argv) > 2 else 3.0
rows = [json.loads(l) for l in open(path) if l.strip()]
# a measure cut short (the game stood still) says little
rows = [r for r in rows if 'dps' in r and r.get('t', 0) >= 12]
by = defaultdict(list)
for r in rows:
    by[(r['cls'], r['floor'])].append(r)
classes = sorted({r['cls'] for r in rows}, key=lambda c: ['warrior', 'assassin', 'ranger', 'mage', 'paladin', 'necro', 'berserker', 'druid', 'monk', 'shaman'].index(c) if c in ['warrior', 'assassin', 'ranger', 'mage', 'paladin', 'necro', 'berserker', 'druid', 'monk', 'shaman'] else 99)
floors = sorted({r['floor'] for r in rows})
print('ideal seconds per pack on normal (pack health / damage per second), geometric mean of the heroes')
print('class      ' + ''.join(f'{f:>8}' for f in floors))
times = defaultdict(dict)
for c in classes:
    line = f'{c:10} '
    for f in floors:
        rs = by.get((c, f))
        if not rs:
            line += f'{"-":>8}'
            continue
        t = gmean([r['packHp'] / max(1, r['dps']) for r in rs])
        times[f][c] = t
        line += f'{t:8.2f}'
    print(line)
print('\nmedian class' + ''.join(f'{st.median(times[f].values()) if times[f] else 0:8.2f}' for f in floors))
print(f'tougher ×   ' + ''.join(f'{target / st.median(times[f].values()) if times[f] else 0:8.2f}' for f in floors))
print('\nclass spread (each class against the median class: >1 = kills faster)')
for c in classes:
    line = f'{c:10} '
    for f in floors:
        if c in times[f]:
            line += f'{st.median(times[f].values()) / times[f][c]:8.2f}'
        else:
            line += f'{"-":>8}'
    print(line)
print('\nshare of the damage from spells / weapon / allies / dots / other (all heroes of the class)')
for c in classes:
    tot = defaultdict(float)
    for r in rows:
        if r['cls'] == c:
            for k, v in r['split'].items():
                tot[k] += v / max(1, r['dps'])
    n = sum(1 for r in rows if r['cls'] == c)
    print(f'{c:10} ' + '  '.join(f'{k} {tot[k] / n:4.2f}' for k in ['spell', 'weapon', 'ally', 'dot', 'other']))
if any('taken' in r for r in rows):
    print('\nshare of the hero\'s health the pack takes per second (normal)')
    for c in classes:
        line = f'{c:10} '
        for f in floors:
            rs = [r for r in by.get((c, f), []) if 'taken' in r]
            line += f'{st.median([r["taken"] for r in rs]):8.3f}' if rs else f'{"-":>8}'
        print(line)
