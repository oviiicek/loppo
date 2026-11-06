#!/usr/bin/env python3
"""Writes the translation job of a language: every text of the game's catalog that the language's file does not
translate yet, with the English translation as a guide and the language's own words for the game's main terms.
   python3 tools/i18n/todo.py <lang> [parts]
The job goes to $DW_OUT/i18n/<lang>/ (default /tmp/dw/i18n/<lang>/): todo.partN.jsonl (one entry per line:
{"i": index, "k": Czech, "en": English, "h": hints}), terms.txt and JOB.txt (what the translator reads)."""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.environ.get('DW_OUT', '/tmp/dw')
lang = sys.argv[1]
parts = int(sys.argv[2]) if len(sys.argv) > 2 else 2
cat = json.load(open(f'{ROOT}/src/i18n/catalog.json'))
have = json.load(open(f'{ROOT}/src/i18n/lang/{lang}.json'))['t']
en = json.load(open(f'{ROOT}/src/i18n/lang/en.json'))['t'] if lang != 'en' else {}
todo = [e for e in cat if e['k'] not in have]
d = f'{OUT}/i18n/{lang}'
os.makedirs(d, exist_ok=True)
for f in os.listdir(d):
    if f.startswith('todo.') or f.startswith('out.'):
        os.remove(f'{d}/{f}')
rows = []
for i, e in enumerate(todo):
    r = {'i': i, 'k': e['k'], 'en': en.get(e['k'], '')}
    if e.get('h'):
        r['h'] = e['h']
    rows.append(r)
json.dump(rows, open(f'{d}/todo.json', 'w'), ensure_ascii=False)
size = -(-len(rows) // max(1, parts)) if rows else 0
files = []
for p in range(parts):
    chunk = rows[p * size:(p + 1) * size]
    if not chunk:
        continue
    fn = f'todo.part{p + 1}.jsonl'
    with open(f'{d}/{fn}', 'w') as f:
        for r in chunk:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    files.append((fn, chunk[0]['i'], chunk[-1]['i']))
# the language's words for the game's main terms (so new texts say them the same way)
TERMS = ['Perly hlubin', 'perla', 'perel', 'Trhlina', 'Strážce trhliny', 'Obchod', 'Získat perly', 'Stopy', 'Nosit', 'Sundat', 'koupeno', 'Kniha moudrosti', 'Měšec štěstí', 'Pírko fénixe', 'Perlová truhla', 'Denní dar', 'Úspěchy', 'Výprava do kobek', 'Desítky pater', 'Postava', 'Inventář', 'Kouzla', 'Talenty', 'Společná hra', 'Hlavní menu', 'Pokračovat', 'Zpět', 'Patro strážce – připrav se!', 'Osud patra', 'Nebezpečná cesta', 'Legendární', 'Epický', 'Mýtický', 'Drahokamy', 'Runy', 'lektvar zdraví', 'zlata', 'Kořist', 'Fontána přání', 'Tábor', 'Mazlíčci', 'Žoldák', 'Kronika', 'Obtížnost', 'Normální', 'Těžká', 'Noční můra', 'Lehká']
lines = [f'{t} → {have[t]}' for t in TERMS if t in have]
open(f'{d}/terms.txt', 'w').write('\n'.join(lines) + '\n')
json.dump({'lang': lang, 'files': files, 'count': len(rows)}, open(f'{d}/job.json', 'w'))
print(f'{lang}: {len(rows)} texts to translate in {len(files)} parts → {d}')
