# Nástroje pro vývoj

Všechno tady se spouští z kořene repozitáře. Před prvním použitím je potřeba nainstalovat závislosti (`npm ci`).
Prohlížečové testy používají Playwright s Chromiem, které je v cloudovém prostředí předinstalované.
Výstupy (sestavení, snímky, měření, překladové úlohy) jdou do `$DW_OUT`, výchozí je `/tmp/dw`.

## Sestavení a server

- `bash tools/serve.sh` sestaví vývojovou verzi (s `window.__dev`) a spustí ji na http://127.0.0.1:4177.
- `bash tools/serve.sh prod` sestaví vydání a spustí ho na http://127.0.0.1:4181.

## Testy (`tools/test/`)

- `lib.mjs`: společné pomocné funkce. Spustí prohlížeč, otevře hru, založí vybavenou postavu (`startGeared`), přeskočí cutscény a sbírá chyby stránky.
- `live.mjs [složka]` projde denní věci od začátku do konce:
  - plamen knotu se svící,
  - cestu nováčka,
  - denní úkoly,
  - sezónu s perlovou cestou,
  - vzhled a kód,
  - denní hlubinu (výsledek, sdílení, stejné rozložení při dalším pokusu, smrt bez ztrát),
  - řádek v hlavním menu.
- `packs.mjs <výstup.jsonl> [classy] [patra] [obtížnosti] [profil] [smeček] [díl/dílů]` měří vyvážení.
  - Hrdina vybavený pro dané patro (hraje ho bot) bojuje se smečkami šesti nestvůr a šampiona.
  - Pro každou konfiguraci se zapíše řádek: čas vyčištění, nejnižší zdraví, vypité lektvary, smrti a co hrdinu zabilo.
  - Profily:
    - `median`: běžný hráč, průměrná výbava.
    - `good`: silná výbava.
    - `full`: silná výbava a všechno, co má hráč, který hraje naplno (talenty, prosperita Loppa, požehnání, přízeň krále, mazlíček).
  - Díl `0/2` a `1/2` rozdělí matici na dva souběžné běhy.

## Překlady (`tools/i18n/`)

1. Po změně textů ve hře: `node scripts/i18n-extract.mjs` (zapíše `src/i18n/catalog.json`).
2. `python3 tools/i18n/todo.py <jazyk> [dílů]` připraví úlohu pro jazyk do `$DW_OUT/i18n/<jazyk>/`:
   - texty, které v jazyce chybí, s anglickým překladem jako vodítkem,
   - slovník hlavních pojmů.
3. Překladatel podle `tools/i18n/GUIDE.md` zapíše `out.partN.json` a zkontroluje ho: `python3 tools/i18n/check.py <jazyk> N`.
4. `python3 tools/i18n/merge.py <jazyk>` vloží hotové překlady do `src/i18n/lang/<jazyk>.json`.

## Nasazení

`bash tools/deploy.sh "Deploy: co se změnilo"`:

1. zkontroluje typy,
2. sestaví vydání,
3. nahraje ho do větve `gh-pages` (https://oviiicek.github.io/loppo/),
4. připraví kopii pro artefakt (`$DW_OUT/artifact/loppo.html` a `assets/`).
