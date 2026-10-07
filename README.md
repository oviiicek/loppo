# Loppo – Nekonečný dungeon

Mobilní akční dungeon RPG na šířku inspirované hrou *Dungeon Madness*. Hra obsahuje náhodně generovaná patra, 10 class, 211 kouzel, loot v 6 kvalitách, vylepšování a očarování vybavení, obchodníky, paklíče, tajné místnosti a bosse. Hraje se v prohlížeči (i v mobilu). Jde nainstalovat jako aplikace (PWA) nebo zabalit do Android/iOS aplikace přes Capacitor.

Celá grafika (postavy, nepřátelé, dlaždice, předměty, efekty i ikony kouzel) se generuje procedurálně v kódu jako pixel-art. Hra nepotřebuje žádné externí obrázky ani zvuky. Zvuky a hudba se syntetizují přes WebAudio.

## Spuštění

```bash
npm install
npm run dev        # vývojový server na http://localhost:5173 (dostupný i z mobilu ve stejné síti)
npm run build      # produkční build do složky dist/
npm run preview    # náhled produkčního buildu
```

Složka `dist/` je statický web. Stačí ji nahrát na libovolný hosting (GitHub Pages, Netlify, Vercel, vlastní server). Na mobilu pak otevři stránku a zvol **Přidat na plochu**. Hra poběží na celou obrazovku a funguje i offline.

### Zabalení do mobilní aplikace (Capacitor)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init Loppo cz.loppo.game --web-dir dist
npm run build
npx cap add android
npx cap sync
npx cap open android   # otevře Android Studio → Build APK
```

Pro iOS je to obdobně s `@capacitor/ios` (vyžaduje macOS a Xcode). V nastavení projektu zamkni orientaci na šířku (landscape).

## Ovládání

| Akce | Mobil | PC |
| --- | --- | --- |
| Pohyb | virtuální joystick vlevo dole | WASD / šipky |
| Základní útok | automatický, když je nepřítel na dosah zbraně | automatický |
| Kouzla 1–3 | malá kulatá tlačítka vpravo | 1, 2, 3 |
| Ultimátní kouzlo | velké tlačítko | 4 |
| Univerzální kouzlo | zelené tlačítko | Q |
| Lektvar zdraví / many | červený / modrý lektvar | H / J |
| Akce (obchod, schody, truhla, svatyně…) | zlaté tlačítko dole | E / mezerník |
| Inventář / Postava / Kouzla | tlačítka nahoře a batoh | I / C / K |
| Pauza | ☰ | Esc |

## Co hra obsahuje

### Dungeon
- Každé patro je náhodně generované a s hloubkou se zvětšuje (od cca 46×34 až po limit 130×96 polí).
- Místnosti různých tvarů: obdélníky, L, kříže, kruhy, osmiúhelníky, jeskyně a sály se sloupy.
- Chodby hledá A* s penalizací zatáček. Kromě nich vznikají smyčky (alternativní cesty), slepé odbočky a malé komůrky s pokladem.
- Speciální místnosti s náhodným výskytem:
  - obchodník (s pojistkou, že se objeví aspoň každé 4. patro),
  - pokladnice se 2–3 truhlami,
  - trezor zamčený dveřmi na paklíč,
  - tajné místnosti za prasklou zdí,
  - svatyně (dočasné požehnání),
  - léčivá fontána,
  - kovadlina,
  - doupě plné nepřátel,
  - knihovna.
- Truhly: dřevěné, železné, zlaté (zamčené, potřebují paklíč) a mimikové. Otevřená truhla zůstane otevřená.
- Každé 5. patro hlídá strážce (boss) s vlastními útoky:
  - vyvolávání pomocníků,
  - kruhy projektilů,
  - salvy,
  - nájezdy,
  - dopady s varováním,
  - déšť meteorů,
  - dech,
  - teleport,
  - spirály.

  Pod 50 % HP se boss rozzuří. Po jeho porážce se objeví 3 truhly a hráč smí otevřít jen jednu. Bossové se po 50. patře vracejí v „Prastaré“ silnější verzi.

### Postava
- 10 class:
  - Bojovník,
  - Assassin,
  - Lučišník,
  - Mág,
  - Paladin,
  - Nekromant,
  - Berserker,
  - Druid,
  - Mnich,
  - Šaman.

  Každá má vlastní pasivní bonus, výchozí zbraň a 20 kouzel, která se odemykají na úrovních 1 až 80. Z nich jsou 4 ultimátní.
- 11 univerzálních kouzel (léčení, sprint, mrknutí, bariéra, regenerace…) dostupných každé classe.
- Aktivní sada kouzel: 3 běžná, 1 ultimátní a 1 univerzální.
- Za každou úroveň 3 body atributů a 1 bod kouzel. Atributy:
  - síla,
  - obratnost,
  - zdraví,
  - mana,
  - magická síla,
  - rychlost útoku.
- Body kouzel zvyšují stupeň kouzla (až 10/10): +15 % síly a −2 % přebíjení za stupeň.
- Classu lze změnit u obchodníka za zlato. Body z kouzel staré classy se vrátí jako volné. Atributy jde u obchodníka také přerozdělit.

### Boj
- Automatický útok podle zbraně:
  - meč, sekera a palcát útočí obloukem na blízko,
  - kopí bodá na delší vzdálenost,
  - luk a kuše střílí šípy,
  - hůl a hůlka vystřelují magické střely.
- Útoky jsou vidět: zbraň se máchá nebo míří a šípy letí.
- Dvě jednoruční zbraně se střídají v útoku a dávají +15 % rychlosti útoku.
- Kritické zásahy, úhyb, blok štítem, brnění, vysávání života, trny a elementální poškození (oheň, mráz, blesk, jed).
- Stavy nepřátel: zpomalení, omráčení, zmrazení, hoření, otrava, krvácení, zranitelnost.
- Nepřátelé (15 typů) s vlastním chováním: na blízko, střelci, kouzelníci, nájezdníci, vyvolávači, slizy, které se dělí, létající, přízraky procházející zdmi a mimikové. Elitní šampioni mají náhodné vlastnosti: rychlý, obrněný, upíří, výbušný nebo mrazivý.
- Vyvolaní spojenci (kostlivci, golemové, vlci, medvěd, ent, elementál…) a totemy.

### Kořist a vybavení
- 6 kvalit:
  - běžná,
  - neobvyklá,
  - vzácná,
  - epická,
  - legendární,
  - mýtická.

  Legendární a mýtické předměty mají unikátní jména a zvláštní efekty, například řetězový blesk, exploze při zabití, extra projektil nebo kouzelnou ozvěnu.
- 23 typů předmětů a 32 typů bonusů. Názvy se generují česky se správným rodem, například „Runová sekera zuřivosti“ nebo „Dračí boty větru“.
- Sloty vybavení:
  - hlavní ruka,
  - druhá ruka (štít, magická koule nebo druhá zbraň),
  - helma,
  - brnění,
  - kalhoty,
  - opasek,
  - boty,
  - 2 prsteny,
  - náhrdelník,
  - náramek.

  Obouruční zbraň zabere obě ruce.
- Grafický inventář s 30 políčky, detailem předmětu a porovnáním s nasazenou výbavou. Předměty jde řadit, prodávat a rozebírat na materiály. Zelená šipka ▲ označuje předměty, které jsou lepší než nasazená výbava.
- Obchodník:
  - náhodné zboží,
  - zpětný odkup omylem prodaných předmětů za stejnou cenu,
  - „tajemné zboží“ (zbraň tvého stylu, zbroj, šperk nebo cokoliv) neznámé kvality s velkou šancí na vzácný až mýtický předmět.
- Kovárna:
  - vylepšení +1 až +10 (šance na úspěch klesá s úrovní),
  - očarování, které přidá nebo přehodí magický efekt.
- Chytrý loot: část zbraní padá podle typu útoku postavy a přednost mají prázdné sloty.

### Prostředí a průzkum
- 5 prostředí, která se střídají po 10 patrech, každé s vlastní paletou a typickými nepřáteli:
  - Kobky,
  - Krypta,
  - Jeskyně,
  - Výheň,
  - Ledové hlubiny.

  Každé končí strážcem.
- Asi čtvrtina pater má náhodný modifikátor. Vyšší riziko přináší lepší odměnu:
  - Temnota,
  - Zlatá horečka,
  - Prokletí,
  - Hordy,
  - Šampioni,
  - Poklady.
- Mlha války s přímou viditelností: neprozkoumané části patra jsou černé.
- Velká mapa po klepnutí na minimapu (klávesa M).
- Rozbitné bedny, sudy a hliněné nádoby s drobnou kořistí. Bodcové pasti v chodbách a místnostech.
- Zlatý skřet: vzácný zloděj, který před hráčem utíká a po 18 sekundách zmizí portálem. Když ho chytíš, vysype hromadu zlata a vzácný předmět. Při Zlaté horečce se objevuje častěji.
- 27 úspěchů s odměnami (zlato, materiály, paklíče, body atributů).
- Barva kovu u zbraní a zbroje odpovídá materiálu předmětu (rezavý, železný, ocelový, runový, mithrilový, dračí, démonický, hvězdný). Vidět je to v inventáři i na zbrani v ruce postavy.

### Ostatní
- Dynamické osvětlení s blikajícími pochodněmi, minimapa s mlhou války, čísla poškození, částicové efekty a otřesy obrazovky.
- Automatické ukládání do `localStorage`: při změně patra, každých 20 s a při odchodu z aplikace. K dispozici jsou 3 sloty pro různé postavy.
- Přenos postavy mezi zařízeními nebo prohlížeči: v menu Postavy tlačítko Přenést vytvoří textový kód a Vložit kód ho na jiném zařízení načte do volného slotu.
- Úložiště u obchodníka (42 míst) pro předměty, které nechceš nosit ani prodat.
- Smrt znamená ztrátu 15 % zlata a části zkušeností. Patro se pak vygeneruje znovu.
- Nápověda na začátku hry. V pauze lze nastavit zvuk, hudbu, vibrace, velikost ovládání a automatické rozebírání slabých předmětů.
- Hlavní menu má živé pozadí, náhodně vygenerovaný dungeon s pochodněmi.
- Tlačítko Zpět na Androidu otevře pauzu místo opuštění hry.

## Struktura projektu

```
src/
  main.ts              konfigurace Phaseru
  data/                classy, kouzla, předměty, nepřátelé, typy
  systems/             generátor dungeonu, stav postavy a ukládání, RNG, zvuk
  gfx/                 procedurální pixel-art (textury, ikony kouzel)
  game/                mapa a kolize, hráč, nepřátelé a spojenci, boj, kouzla, loot, AI bossů, efekty
  scenes/              Boot, Game (hlavní herní smyčka), Gallery (náhled grafiky)
  ui/                  HTML/CSS rozhraní: HUD, joystick, inventář, postava, kouzla, obchod, menu
  dev.ts               vývojářské nástroje (jen v dev režimu), včetně bota, který hru sám hraje
```

## Vývojářské nástroje

- `http://localhost:5173/?gallery` zobrazí všechny vygenerované textury.
- V dev režimu je v konzoli objekt `__dev`:
  - `__dev.start('mage', 30, 10)` spustí postavu na úrovni 30 v patře 10,
  - `__dev.castAll('mage')` sešle všechna kouzla classy,
  - `__dev.bot(true)` zapne bota, který hraje sám,
  - `__dev.speed(3)` zrychlí herní logiku.
