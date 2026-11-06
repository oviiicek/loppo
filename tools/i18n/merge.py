#!/usr/bin/env python3
"""Puts a language's checked translations into the game: src/i18n/lang/<lang>.json gets every text of
out.part*.json under its Czech key (placeholders checked once more; the item names part stays as it is).
   python3 tools/i18n/merge.py <lang>"""
import json, os, re, sys, glob
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.environ.get('DW_OUT', '/tmp/dw')
lang = sys.argv[1]
d = f'{OUT}/i18n/{lang}'
PH = re.compile(r'\{\d+\}')
todo = {str(r['i']): r['k'] for r in json.load(open(f'{d}/todo.json'))}
p = f'{ROOT}/src/i18n/lang/{lang}.json'
cat = json.load(open(p))
n = skipped = 0
for f in sorted(glob.glob(f'{d}/out.part*.json')):
    for i, v in json.load(open(f)).items():
        k = todo.get(i)
        if k is None or not isinstance(v, str) or not v.strip() or sorted(PH.findall(k)) != sorted(PH.findall(v)):
            skipped += 1
            continue
        cat['t'][k] = v
        n += 1
json.dump(cat, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
print(f'{lang}: {n} texts merged, {skipped} skipped, {len(cat["t"])} in all')
