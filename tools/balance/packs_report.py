#!/usr/bin/env python3
"""Reads the pack probe's lines (tools/test/packs.mjs) and prints, for each difficulty, class and floor, how long a
pack took (geometric mean of the heroes), the share of the hero's health its blows took and the deaths; then how
much tougher (health) and harder hitting (damage) the monsters of each floor would have to be for the median
class to need TARGET seconds per pack and lose DANGER of its health.
   python3 tools/balance/packs_report.py <packs.jsonl> [target seconds] [danger share]"""
import json, sys, math
from collections import defaultdict

def gmean(xs):
    xs = [x for x in xs if x and x > 0]
    return math.exp(sum(math.log(x) for x in xs) / len(xs)) if xs else 0

def med(xs):
    xs = sorted(xs)
    return xs[len(xs) // 2] if xs else 0

rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
rows = [r for r in rows if 't' in r and r.get('packs')]
target = float(sys.argv[2]) if len(sys.argv) > 2 else 6.0
danger = float(sys.argv[3]) if len(sys.argv) > 3 else 0.45
ORDER = ['warrior', 'assassin', 'ranger', 'mage', 'paladin', 'necro', 'berserker', 'druid', 'monk', 'shaman']
for dif in sorted({r['dif'] for r in rows}):
    rs = [r for r in rows if r['dif'] == dif]
    classes = sorted({r['cls'] for r in rs}, key=lambda c: ORDER.index(c) if c in ORDER else 99)
    floors = sorted({r['floor'] for r in rs})
    by = defaultdict(list)
    for r in rs:
        by[(r['cls'], r['floor'])].append(r)
    print(f'\n=== difficulty {dif}: seconds per pack / health lost per pack / deaths of packs')
    print('class      ' + ''.join(f'{f:>16}' for f in floors))
    tm = defaultdict(dict)
    ls = defaultdict(dict)
    for c in classes:
        line = f'{c:10} '
        for f in floors:
            x = by.get((c, f))
            if not x:
                line += f'{"-":>16}'
                continue
            t = gmean([r['t'] for r in x])
            lost = sum(r.get('lost', 1 - r['minHp']) for r in x) / len(x)
            d = sum(r['deaths'] for r in x)
            n = sum(r['packs'] for r in x)
            tm[f][c] = t
            ls[f][c] = lost
            line += f'{t:6.1f}/{lost:4.2f}/{d}:{n:<2}'.rjust(16)
        print(line)
    print('median     ' + ''.join(f'{med(list(tm[f].values())):6.1f}/{med(list(ls[f].values())):4.2f}'.rjust(16) for f in floors))
    print(f'×health    ' + ''.join(f'{target / med(list(tm[f].values())) if tm[f] else 0:16.2f}' for f in floors))
    # the damage scales the health lost; longer fights (more health) scale it too
    print(f'×damage    ' + ''.join(f'{(danger / med(list(ls[f].values()))) / (target / med(list(tm[f].values()))) if tm[f] and med(list(ls[f].values())) else 0:16.2f}' for f in floors))
