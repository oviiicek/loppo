#!/usr/bin/env python3
"""Checks a translator's output against the job: every index of the part present, placeholders kept, valid JSON.
   python3 tools/i18n/check.py <lang> <part number>      (reads out.partN.json next to todo.partN.jsonl)"""
import json, os, re, sys
OUT = os.environ.get('DW_OUT', '/tmp/dw')
lang, n = sys.argv[1], sys.argv[2]
d = f'{OUT}/i18n/{lang}'
PH = re.compile(r'\{\d+\}')
src = [json.loads(l) for l in open(f'{d}/todo.part{n}.jsonl')]
try:
    out = json.load(open(f'{d}/out.part{n}.json'))
except Exception as e:
    print('INVALID JSON or missing file:', e)
    sys.exit(1)
bad = 0
for r in src:
    v = out.get(str(r['i']))
    if not isinstance(v, str) or not v.strip():
        print('missing', r['i'], r['k'][:60])
        bad += 1
    elif sorted(PH.findall(r['k'])) != sorted(PH.findall(v)):
        print('placeholders', r['i'], r['k'][:60], '→', v[:60])
        bad += 1
extra = set(out) - {str(r['i']) for r in src}
if extra:
    print('extra indices', sorted(extra)[:10])
    bad += len(extra)
print('ALL GOOD' if not bad else f'{bad} problems')
sys.exit(1 if bad else 0)
