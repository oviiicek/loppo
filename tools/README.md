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
- `packs.mjs <výstup.jsonl> [classy] [patra] [obtížnosti] [profil] [smeček] [díl/dílů] [hrdinů]` měří vyvážení.
  - Hrdina vybavený pro dané patro (hraje ho bot) bojuje se smečkami šesti nestvůr a šampiona.
  - Pro každou konfiguraci se zapíše řádek: čas vyčištění, nejnižší zdraví, vypité lektvary, smrti a co hrdinu zabilo.
  - Profily:
    - `median`: běžný hráč, průměrná výbava.
    - `good`: silná výbava.
    - `full`: silná výbava a všechno, co má hráč, který hraje naplno (talenty, prosperita Loppa, požehnání, přízeň krále, mazlíček).
  - Díl `0/2` a `1/2` rozdělí matici na dva souběžné běhy.
  - Poslední argument je počet hrdinů na konfiguraci (každý s jinou náhodnou výbavou).
  - Zapíše se i podíl zdraví, který hrdinovi vzaly rány během smečky (`lost`).
  - Co už ve výstupu je, se znovu neměří. Přerušený běh tak pokračuje, kde skončil.
- `dps.mjs <výstup.jsonl> [classy] [patra] [profil] [sekund] [hrdinů] [díl/dílů]` je měřič poškození.
  - Hrdina bojuje se smečkou, která zůstává celá: padlou nestvůru hned nahradí stejná.
  - Hrdina nemůže padnout. Zdraví, které mu rány vezmou, se mu hned vrátí a jen se sečte (`taken`).
  - Počítá se jen poškození, které nestvůře ještě zbývalo, rozdělené podle zdroje (zbraň, kouzla, spojenci, poškození v čase, ostatní).
  - Výsledek je čas, za který by padla smečka (její zdraví děleno poškozením za sekundu).
- `table.mjs [classy] [profil] [obtížnosti] [patra] [hrdinů]` je rychlá tabulka bez hraní.
  - Na každém patře ukáže, kolik ran zbraní a kouzly vydrží běžná nestvůra a kolik ran vydrží hrdina.
- `fit.mjs [složka] [velikosti]` projde obrazovky a panely v různých velikostech okna.
  - Hledá useknutý text, obrázky větší než rámeček a prvky mimo obrazovku.
  - Zapíše snímky a `fit.json`.
- `feature.mjs [obrázek] [cs|en]` vytvoří grafiku pro Google Play (1024 × 500).
- `storeshots.mjs [složka] [jazyk]` vytvoří snímky obrazovky pro obchody (1920 × 1080).

## Vyvážení (`tools/balance/`)

- `packs_report.py <packs.jsonl> [sekund] [podíl]` shrne výsledky `packs.mjs` za každou obtížnost, classu a patro.
  - Ukazuje čas na smečku, ztracené zdraví a smrti.
  - Navrhne, o kolik zvýšit zdraví a poškození nestvůr na každém patře, aby smečka trvala zadaný čas a vzala zadaný podíl zdraví.
- `dps_report.py <dps.jsonl>` a `fit.py <dps.jsonl> [sekund]` shrnou výsledky měřiče poškození.
  - Navrhnou sílu kouzel každé classy (`CLASS_POWER` v `src/data/spells.ts`) a zdraví nestvůr podle pater (`packHpMult` v `src/data/enemies.ts`).

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
