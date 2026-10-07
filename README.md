# Loppo – Nekonečný dungeon

Mobilní akční dungeon RPG na šířku inspirované hrou *Dungeon Madness*. Hra obsahuje příběh s cutscénami (250 pater, 5 prostředí, příběhoví bossové), náhodně generovaná patra, 10 class, 211 kouzel, loot v 6 kvalitách, vylepšování a očarování vybavení, obchodníky, paklíče, tajné místnosti a bosse. Hraje se v prohlížeči (i v mobilu). Jde nainstalovat jako aplikace (PWA) nebo zabalit do Android/iOS aplikace přes Capacitor.

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

| Akce | Mobil | PC | Ovladač (gamepad) |
| --- | --- | --- | --- |
| Pohyb | virtuální joystick vlevo dole | WASD / šipky | levá páčka |
| Základní útok | automatický, když je nepřítel na dosah zbraně | automatický | automatický |
| Kouzla 1–3 | malá kulatá tlačítka vpravo | 1, 2, 3 | X, Y, B |
| Ultimátní kouzlo | velké tlačítko | 4 | RT |
| Univerzální kouzlo | zelené tlačítko | Q | RB |
| Lektvar zdraví / many | červený / modrý lektvar | H / J | LB / LT |
| Akce (obchod, schody, truhla, svatyně…) | zlaté tlačítko dole | E / mezerník | A |
| Inventář / Postava / Kouzla / Mapa | tlačítka nahoře, batoh a minimapa | I / C / K / M | křížový ovladač → / ↑ / ← / ↓ (inventář i Back) |
| Pauza | ☰ | Esc | Start |

Ovladač stačí připojit (USB nebo Bluetooth) a zmáčknout tlačítko. V menu, inventáři a dialozích se výběr posouvá křížovým ovladačem nebo levou páčkou, A potvrdí, B vrátí zpět, LB / RB přepínají záložky a pravá páčka posouvá dlouhé texty. A posouvá příběhové scény, B je přeskočí. Otázky typu „Prodat / Rozebrat cenný předmět?“ začínají na bezpečné odpovědi, takže dvojí stisk A nic nezničí. Když se hraje ovladačem, ukazují tlačítka kouzel a lektvarů jeho tlačítka (u ovladače PlayStation symboly ✕ ○ □ △) a ovladač při zásahu krátce zavibruje.

## Co hra obsahuje

### Příběh
Pod vesnicí Loppo spí Nyx'thar, Pán hlubin, spoutaný pečetí s pěti zámky. Pečeť praská. Stará strážkyně Ilda posílá hrdinu dolů. Má obnovit zámky a najít její dceru Elaru, která sestoupila před rokem a nevrátila se.

- **Cutscény:** ilustrované pixel-art scény s portréty postav a postupně psaným textem. Jdou přeskočit a všechny zhlédnuté se dají přehrát znovu v **Kronice** (pauza).
  - prolog,
  - úvod každé kapitoly,
  - rozhovory se strážci,
  - konec příběhu.
- **250 pater, 5 prostředí po 50 patrech**, každé s vlastními zdmi, podlahou, světly, dekoracemi a nestvůrami:
  - Zapomenuté kobky (cihly),
  - Hladové jeskyně (balvany, svítící houby),
  - Ledové hlubiny (sníh, rampouchy),
  - Ohnivá výheň (čedič, láva),
  - Propast (obsidián, runy).
- **Příběhoví strážci** každých 50 pater, s vlastním vzhledem a útoky:
  - 50: Morgrim, Strážce bran (řetěz, máchnutí sekerou),
  - 100: Matka spor, **2 fáze** (jedovaté mraky, kořeny),
  - 150: Isolda, Ledová královna (ledové vězení, déšť střepů),
  - 200: Elara, Hlas hlubin, **3 fáze** (stínové sestry, stínová křídla),
  - 250: Nyx'thar, Pán hlubin, **3 fáze** (ruce tmy, paprsky, jámy prázdnoty).

  Ve stovkách a na konci se strážce po vyčerpání zdraví promění a dostane nový ukazatel zdraví.
- **Pečetní střepy:** za každého z prvních čtyř strážců získáš střep, který dává trvale +4 % zdraví, poškození a síly kouzel. Za záchranu Elary navíc dostaneš požehnání +10 %.
- **Stránky deníku:** na každém desátém patře leží stránka Elařina deníku nebo vzkaz (celkem 20).
- **Nekonečná hlubina:** po skončení příběhu pokračují patra 251+ a obtížnost dál roste.

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

  Pod 50 % HP se boss rozzuří. Po jeho porážce se objeví 3 truhly a hráč smí otevřít jen jednu. Bossové se v dalších prostředích vracejí v „Prastaré“ verzi s více pomocníky. Každé 50. patro patří příběhovému strážci (viz Příběh).

### Obtížnost
- Při zakládání postavy (po výběru classy) se volí jedna ze 4 obtížností boje:

  | Obtížnost | Zdraví nepřátel | Poškození nepřátel | Odměny | Smrt stojí |
  |---|---|---|---|---|
  | Lehká | −35 % | −40 % | běžné | 5 % zlata |
  | Normální | běžné | běžné | běžné | 15 % zlata |
  | Těžká | +35 % | +30 % | +25 % zkušeností a zlata, lepší kořist | 20 % zlata |
  | Noční můra | +80 % | +60 % | +60 % zkušeností a zlata, mnohem lepší kořist | 25 % zlata |

  Na vyšších obtížnostech jsou nepřátelé i trochu rychlejší a častěji elitní (na Lehké naopak méně). Platí to i pro strážce. Obtížnost jde změnit v pauze; změna platí od dalšího patra.
- **☠ Hardcore:** volitelný režim s jediným životem. Po smrti se postava hned smaže a začínáš znovu s novou postavou. Padlí hrdinové se zapisují do Síně padlých (menu Postavy). Hardcore jde zapnout jen při zakládání postavy.

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
- Každá classa má vlastní detailní postavičku (kreslenou ve dvojnásobném rozlišení). Když stojí, dýchá a mrká a občas se podrbe na hlavě, rozhlédne nebo protáhne.
- Mimo boj nosí postava zbraň na zádech nebo u opasku (štít na zádech, kastety a magická koule se schovají). Jakmile se přiblíží nepřítel, zbraň tasí, a 5–10 s po skončení boje ji zase zasune.

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
- Nepřátelé (23 typů, každé prostředí má své) s vlastním chováním: na blízko, střelci, kouzelníci, nájezdníci, vyvolávači, slizy, které se dělí, létající, přízraky procházející zdmi a mimikové. Elitní šampioni mají náhodné vlastnosti: rychlý, obrněný, upíří, výbušný nebo mrazivý.
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
- Grafický inventář s 30 políčky. Po klepnutí na předmět jsou v detailu nahoře tlačítka Nasadit (u jednoručních zbraní „Do pravé ruky“ a „Do levé ruky“, u prstenů Prsten 1 a 2), Prodat, Rozebrat a Zahodit, pod nimi porovnání s nasazenou výbavou a pak vlastnosti předmětu. Předměty, které se vejdou do dvou slotů, se porovnávají s oběma nasazenými a lepší volba je označená ▲.
- Prodávat jde přímo z inventáře kdekoliv (vzácné a lepší předměty se nejdřív potvrdí). Předměty jde také řadit a rozebírat na materiály. Zelená šipka ▲ označuje předměty, které jsou lepší než nasazená výbava, a tlačítko „Nasadit lepší“ je nasadí jedním klepnutím.
- Sebrané předměty a materiály se ukazují v malém seznamu vlevo pod životy, oznámení o nové úrovni nahoře uprostřed.
- Obchodník:
  - náhodné zboží,
  - zpětný odkup omylem prodaných předmětů za stejnou cenu,
  - „tajemné zboží“ (zbraň tvého stylu, zbroj, šperk nebo cokoliv) neznámé kvality s velkou šancí na vzácný až mýtický předmět.
- Kovárna:
  - vylepšení +1 až +10 (šance na úspěch klesá s úrovní),
  - očarování, které přidá nebo přehodí magický efekt.
- Chytrý loot: část zbraní padá podle typu útoku postavy a přednost mají prázdné sloty.

### Prostředí a průzkum
- Každé z 5 prostředí (po 50 patrech) se dělí na pět oblastí po 10 patrech a každá má své jméno:
  - Kobky: Vstupní síně, Strážnice, Vězení, Katakomby, Brána hlubin,
  - Jeskyně: Kapající chodby, Houbový les, Podzemní řeka, Pavoučí doupata, Srdce jeskyní,
  - Ledové hlubiny: Zamrzlé vodopády, Krystalové síně, Ledová pustina, Hrobka zimy, Isoldin trůn,
  - Výheň: Popelavé pláně, Lávové řeky, Kovárny Pětice, Řetězové mosty, Srdce výhně,
  - Propast: Okraj prázdnoty, Plovoucí ostrovy, Šepot tmy, Hlubina snů, Dno světa.
- Přechod do dalšího patra: postava dojde ke schodům a sejde po nich do tmy. Na černé obrazovce se objeví číslo patra, jméno oblasti a co na patře čeká (strážce, modifikátor, obchodník). Na novém patře postava sejde ze schodů, které vedou z patra nad ním. Klepnutím se dá karta zkrátit.
- Asi čtvrtina pater má náhodný modifikátor. Vyšší riziko přináší lepší odměnu:
  - Temnota,
  - Zlatá horečka,
  - Prokletí,
  - Hordy,
  - Šampioni,
  - Poklady.
- Mlha války s přímou viditelností: neprozkoumané části patra jsou černé.
- Velká mapa po klepnutí na minimapu (klávesa M). Když jsou objevené schody nebo obchodník mimo minimapu, ukazuje k nim šipka na jejím okraji.
- Rozbitné bedny, sudy a hliněné nádoby s drobnou kořistí. Bodcové pasti v chodbách a místnostech.
- Zlatý skřet: vzácný zloděj, který před hráčem utíká a po 18 sekundách zmizí portálem. Když ho chytíš, vysype hromadu zlata a vzácný předmět. Při Zlaté horečce se objevuje častěji.
- 27 úspěchů s odměnami (zlato, materiály, paklíče, body atributů).
- Barva kovu u zbraní a zbroje odpovídá materiálu předmětu (rezavý, železný, ocelový, runový, mithrilový, dračí, démonický, hvězdný). Vidět je to v inventáři i na zbrani v ruce postavy.

### Ostatní
- Dynamické osvětlení s blikajícími pochodněmi, minimapa s mlhou války, čísla poškození, částicové efekty a otřesy obrazovky.
- Automatické ukládání do `localStorage`: při změně patra, každých 20 s a při odchodu z aplikace. K dispozici jsou 3 sloty pro různé postavy.
- Přenos postavy mezi zařízeními nebo prohlížeči: v menu Postavy tlačítko Přenést vytvoří textový kód a Vložit kód ho na jiném zařízení načte do volného slotu.
- Úložiště u obchodníka (42 míst) pro předměty, které nechceš nosit ani prodat.
- Smrt znamená ztrátu části zlata a zkušeností (podle obtížnosti 5–25 % zlata). Patro se pak vygeneruje znovu. V režimu Hardcore postava po smrti navždy zmizí.
- Nápověda na začátku hry. V pauze lze nastavit zvuk, hudbu, vibrace, velikost ovládání, automatické rozebírání slabých předmětů a úspornou grafiku (bez dynamického osvětlení, pro slabší telefony).
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
