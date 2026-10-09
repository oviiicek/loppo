# Loppo – Nekonečný dungeon

Mobilní akční dungeon RPG na šířku inspirované hrou *Dungeon Madness*. Hra obsahuje příběh s cutscénami (250 pater, 25 oblastí, 7 příběhových strážců), náhodně generovaná patra, 10 class, 211 kouzel, loot v 6 kvalitách, vylepšování a očarování vybavení, obchodníky, paklíče, tajné místnosti, bosse, 8 mazlíčků, prokleté truhly a úkoly pater. Hraje se v prohlížeči (i v mobilu). Jde nainstalovat jako aplikace (PWA) nebo zabalit do Android/iOS aplikace přes Capacitor.

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
| Inventář / Postava / Kouzla / Mapa | batoh vpravo dole, portrét vlevo nahoře, kniha kouzel nahoře, minimapa | I / C / K / M | křížový ovladač → / ↑ / ← / ↓ (inventář i Back) |
| Výběr více předmětů (prodej, rozebrání) | podržet předmět, pak klepat na další | Ctrl / Shift + klik | – |
| Pauza | ☰ | Esc | Start |

Když čekají nevyužité body atributů, zlatý rámeček portrétu září; u nevyužitých bodů kouzel a talentů září kniha kouzel.

Ovladač stačí připojit (USB nebo Bluetooth) a zmáčknout tlačítko. V menu, inventáři a dialozích se výběr posouvá křížovým ovladačem nebo levou páčkou, A potvrdí, B vrátí zpět, LB / RB přepínají záložky a pravá páčka posouvá dlouhé texty. A posouvá příběhové scény, B je přeskočí. Otázky typu „Prodat / Rozebrat cenný předmět?“ začínají na bezpečné odpovědi, takže dvojí stisk A nic nezničí. Když se hraje ovladačem, ukazují tlačítka kouzel a lektvarů jeho tlačítka (u ovladače PlayStation symboly ✕ ○ □ △) a ovladač při zásahu krátce zavibruje.

## Co hra obsahuje

### Příběh
Pod vesnicí Loppo spí Nyx'thar, Pán hlubin. Před tisíci lety ho spoutala Pětice – čarodějka Isolda, druidka Květa, rytíř Morgrim, kovář Bořiv a kněžka Svatava – pečetí s pěti zámky. Tři z nich zůstali dole jako strážci a jeho hlas z nich za tisíc let udělal nestvůry. Pečeť praská. Stará strážkyně Ilda posílá hrdinu dolů: obnovit zámky a najít její dceru Elaru, která sestoupila před rokem a nevrátila se.

- **Cutscény:** ilustrované pixel-art scény s portréty postav a postupně psaným textem. Jdou přeskočit a všechny zhlédnuté se dají přehrát znovu v **Kronice** (pauza), seřazené podle pater.
  - prolog,
  - úvodní scéna každé oblasti (24 scén, každá na prvním patře své desítky),
  - stránka v táboře každé oblasti (25 stránek: Elařin deník, šepot z hlubin, Ildiny vzkazy a nápisy Pětice),
  - rozhovory se strážci a scény mezi jejich fázemi,
  - konec příběhu.
- **250 pater v 5 kapitolách** (Mrazivá pečeť, Hladové hlubiny, Brána podsvětí, Stínová citadela, Dno světa), **každých 10 pater jiná oblast** – viz Prostředí. Každá oblast má vlastní ilustraci (krypta, katakomby, zatopené ruiny, ledová síň, démonický idol, houbový les, pavoučí hnízda, hrobka pouštních králů, kořeny světa, krystaly, trpasličí síně, kostnice, zatopená katedrála, brána podsvětí, popelavé pláně, kovárny, bažiny, obsidián, stínová citadela, okraj prázdnoty, plovoucí ostrovy, zrcadlový palác, hlubina snů a dno světa).
- **Příběhoví strážci** s vlastním vzhledem, útoky a délkou boje:

  | Patro | Strážce | Fáze | Boj trvá zhruba |
  |---|---|---|---|
  | 25 | Opat Benedikt, Pán katakomb | 1 | 2–3 minuty |
  | 50 | Isolda, Ledová královna | 3 (vánice, srdce z ledu) | 10 minut |
  | 100 | Matka spor, Srdce kořenů | 4 (vykvétá, kořeny, poslední květ) | 15 minut |
  | 125 | Grot, Žalářník kostnice | 1 | 2–3 minuty |
  | 150 | Morgrim, Strážce bran | 3 (rozžhavená zbroj, poslední stráž) | 10 minut |
  | 200 | Elara, Hlas hlubin | 4 (stínové sestry, stínová křídla, hlas v Elaře) | 15 minut |
  | 250 | Nyx'thar, Pán hlubin | 5 | asi 20 minut |

  Nyx'thar bojuje v pěti fázích: nejdřív se drží zpátky (pomalý, ale silný), pak ho střepy pečeti spálí a probudí se, potom ukáže pravou podobu, pečeť mu usekne paži (zuří a je rychlý) a poslední fáze – srdce hlubin – je opravdu těžká. Každá fáze má vlastní ukazatel zdraví a v poslední fázi strážce ještě přitvrdí na 70, 40 a 10 % zdraví.
  Délka boje se drží u všech hrdinů: fáze nejde uspěchat pod zhruba devět desetin jejího času (přebytek poškození velmi silného hrdiny strážce pohltí, krádež života se ale počítá z celého zásahu) a když se fáze táhne přes 1,3násobek času, začnou strážce spalovat střepy pečeti. V dlouhých fázích je každý úder strážce i jeho služebníků slabší – je to boj o vytrvalost a uhýbání, ne o jednu ránu. Na vyšší obtížnosti strážci víc bolí, ale boj netrvá déle.
  Po smrti v aréně se hrdina probudí u ohně v přípravné místnosti a souboj začíná znovu od první fáze.
- **Pečetní střepy:** za každého strážce zámku (50, 100, 150, 200) získáš střep, který dává trvale +4 % zdraví, poškození a síly kouzel. Za záchranu Elary navíc dostaneš požehnání +10 %.
- **Poslední kapitola (201–250) je hodně těžká:** nestvůry mají postupně až o 60 % víc zdraví a o 20 % víc poškození, je víc šampionů (a za ně víc zkušeností).
- **Nekonečná hlubina:** po skončení příběhu pokračují patra 251+ – oblasti se vracejí (Stará krypta II …) a obtížnost dál roste.

### Dungeon
- Každé patro je náhodně generované. V každé desítce jsou první patra malá a ke konci rostou (1. patro desítky asi 50×36 polí, 9. patro až 126×90 polí; první desítky tolik nerostou).
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
- Kobky se dělí na desítky pater. Na posledním patře každé desítky (10., 20., 30. …) hlídá strážce (boss) s vlastními útoky:
  - vyvolávání pomocníků,
  - kruhy projektilů,
  - salvy,
  - nájezdy,
  - dopady s varováním,
  - déšť meteorů,
  - dech,
  - teleport,
  - spirály.

  Pod 50 % HP se boss rozzuří. Bossové se v dalších prostředích vracejí v „Prastaré“ verzi s více pomocníky. Příběhoví strážci čekají na 25., 50., 100., 125., 150., 200. a 250. patře (viz Příběh).
- **Patro strážce:** od schodů vede krátká chodba do **přípravné místnosti** – ohniště (plné zdraví a mana, posila na 5 minut), obchodník, kovadlina, alchymista a truhla úložiště – a za ní je aréna. Jakmile do ní hrdina vstoupí, zavře se za ním runová bariéra a otevře se až po porážce strážce (mazlíček a žoldák jdou s ním). Smrt v aréně vrací do přípravné místnosti stejného patra, takže jde změnit výbavu a zkusit to znovu.
- **Poklad strážce:** poražený strážce vysype svůj poklad přímo v aréně – předměty (první aspoň epický), zlato, drahokam, materiály, často runu – a navíc jednu jistou epickou nebo lepší věc, kterou hrdina může použít. Příběhový strážce dá poklad dvakrát a jistá věc je legendární nebo mýtická.

### Obtížnost
- Při zakládání postavy (po výběru classy) se volí jedna ze 4 obtížností boje:

  | Obtížnost | Zdraví nepřátel | Poškození nepřátel | Odměny | Smrt stojí |
  |---|---|---|---|---|
  | Lehká | −35 % | −40 % | běžné | 5 % zlata |
  | Normální | +20 % | +22 % | běžné | 15 % zlata |
  | Těžká | +60 % | +55 % | +25 % zkušeností a zlata, lepší kořist | 20 % zlata |
  | Noční můra | +120 % | +95 % | +60 % zkušeností a zlata, mnohem lepší kořist | 25 % zlata |

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
- Classu lze změnit u obchodníka (nebo na cvičišti v Loppu) za zlato. Body z kouzel staré classy se vrátí jako volné. Atributy jde také přerozdělit.
- **Talentové stromy:** každá classa má 3 větve talentů (např. Bojovník: tank, obouruční zbraně, dvě zbraně; Mág: oheň, mráz, blesk; Assassin: jed, kritické zásahy, stealth). Bod talentu je za každou druhou úroveň, hlubší talenty se otevírají podle bodů ve větvi a na konci každé větve čeká silná schopnost. Talenty jde zapomenout za zlato (v záložce Kouzla → Talenty).
- **Multiclass:** od úrovně 100 si hrdina zvolí druhou classu. Dostane polovinu jejího pasivního bonusu, může používat její kouzla, investovat do jejích talentů (omezený počet bodů) a nese spojený titul (Bitevní mág, Stínový mág, Hraničář…).
- Hrdina může mít vlastní jméno (podle něj si ho pamatují nemesis).
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
- Kritické zásahy, úhyb, blok štítem, brnění, vysávání života a many, trny a elementální poškození (oheň, mráz, blesk, jed).
- **Vysávání s limitem:** vysávání života a many léčí z rozdaného poškození, ale nejvýš 8 % maximálního zdraví a 10 % many za sekundu – hrdina nemůže být nesmrtelný.
- **Trny jako styl boje:** pevné trny i odraz části přijatého poškození (nový atribut na zbroji, štítu, helmě a náramku) se vrací útočníkům a jdou přes jejich brnění. Sada Hradba trnů (helma, krunýř, štít, náramek) a unikáty Ostnatý krunýř (brnění zesiluje trny), Trnová koruna a Ježek (trny zasáhnou i střelce a každou sekundu nestvůry těsně u hrdiny) z toho dělají celý build.
- Stavy nepřátel: zpomalení, omráčení, zmrazení, hoření, otrava, krvácení, zranitelnost.
- **Nestvůry (přes 60 druhů) v rodinách:** každá oblast deseti pater patří dvěma rodinám a každá místnost má smečku jedné z nich (občas host odjinud):
  - Nemrtví: kostlivec → kostěný lučištník (drží odstup a couvá) → zombie → kostěný rytíř (ochránce) → kostěný mág → nekromant (oživuje padlé) → kostěný odstřelovač (dlouho míří, obrovský zásah) → duch (zbraně jím procházejí, kouzla ho trhají) → kostěný obr → temný mág → stín (útočí ze zdí) → strážce Kostěný král,
  - Pavouci: malý pavouk → jedovatý pavouk → pavouk tkadlec (lepkavé sítě) → výbušný pavouk → pavoučí strážce → Pavoučí matka (klade vejce) → strážkyně Pavoučí královna,
  - Ghúlové: ghúl (skáče na kořist), morový ghúl (jedovatý mrak), hladový ghúl (žere mrtvé a sílí), alfa ghúl (řev přivolá smečku), mutovaný ghúl (náhodná mutace),
  - Golemové: kamenný (extrémní pancíř, pomalý), rozbitý (rozpadne se na dva menší), krystalový (odráží magii), lávový (hořící stopa), bouřný (elektrické výboje),
  - Kult: kultista, prokletá čarodějnice (kletby rozkladu a únavy), temný kněz (žehná smečce, hrdinu označí zranitelností), krvavá čarodějnice (obětuje zdraví ostatních), portálový mág (portály s nestvůrami), iluzionista (tři falešné kopie), časový mág (zrychlí nestvůry, zpomalí čas hrdinovi), mág mysli (obrátí ovládání), lovec mágů (skočí k hrdinovi po každém kouzlu),
  - Upíři: netopýří roj (jednotlivá kouzla ho minou), vampýr (teleport, sání krve, proměna v netopýry), vampýrský lord (krvavé louže, silné vysávání),
  - Prázdnota: manová bestie (druhý ukazatel – štít z many), požírač buffů (krade posílení), zrcadlový démon (kopíruje kouzlo hrdiny), adaptivní monstrum (získává odolnost vůči opakovanému druhu poškození),
  - a dál zelenokožci (goblin šaman léčí, ork berserkr odhazuje), jeskynní havěť, mráz a peklo.
- **Znamení nad hlavou:** nestvůry, které je třeba zabít první (léčitel, křísitel, vyvolávač, ochránce, odstřelovač, posilovač, zaklínač), nesou nad hlavou barevnou značku.
- **Kletby na hrdinu:** zranitelnost, kletba rozkladu (méně léčení), kletba únavy (pomalejší útoky), zpomalený čas a zmatení (obrácené ovládání) – vidět v liště posílení s červeným rámečkem.
- **Zkažené nestvůry:** velmi vzácně se objeví černofialová zkažená verze nestvůry – pětinásobné zdraví, tři náhodné vlastnosti šampionů, temná aura a vždy dobrá kořist (aspoň epický předmět, drahokam, runa, materiály).
- **Šampioni** mají vlastnosti, které jsou vidět na jejich záři: rychlý, obrněný, upíří, výbušný, mrazivý, ohnivý (hořící stopa), elektrický (blesky), léčitel, teleportér, vyvolávač a hlouběji i zuřivý, jedovatý, štítonoš, magnetický (přitahuje hrdinu), zrcadlový (vrací část poškození) a nesmrtelný (jednou vstane z mrtvých). Od 25. patra mívají dvě vlastnosti, od 60. až tři a od 120. vždy tři – každá navíc jim přidá zdraví a zkušenosti.
- **Bestiář:** každý druh nestvůry má slabiny a odolnosti vůči živlům (slabina = poškození ×1,5, odolnost = ×0,6; duch se třeba bojí svatého světla) a je seřazený podle rodin s popisem role. Zabíjením se bestiář plní: po 10 zabitích ukáže slabiny, po 25 kořist, po 50 a 100 dá mistrovství (+5 / +10 % poškození proti tomu druhu). Najdeš ho v Úspěších.
- **Fáze strážců:** při 70, 40 a 10 % zdraví strážce změní chování – naučí se nové útoky (bodce, kříže, novy, pavučiny, vysávání), promění arénu (hořící zem, padající kamení, temnota, která zužuje světlo) a v posledních 10 % zuří a útočí rychleji. Ukazatel zdraví má značky fází.
- **Série zabití:** rychle po sobě poražené nestvůry tvoří sérii; od 5 zabití dá na konci bonusové zkušenosti.
- Vyvolaní spojenci (kostlivci, golemové, vlci, medvěd, ent, elementál…) a totemy.

### Kořist a vybavení
- 7 kvalit:
  - běžná,
  - neobvyklá,
  - vzácná,
  - epická,
  - legendární,
  - mýtická,
  - **pradávná** (krvavě rudá, nejvzácnější – jen z velkého štěstí nebo transmutace).

  Legendární a lepší předměty jsou **unikáty** s vlastním jménem a vlastní mechanikou (61 unikátů, 30 schopností): luk, jehož šípy se odrážejí, meč, který z poražených vyvolá stíny, prsten, který jednou za minutu zachrání před smrtí, meteor při kritickém zásahu, bouřková aura, krvežíznivost…
- **Drahokamy a sokety:** předměty mívají sokety (další jde vyvrtat v kovárně). Drahokamy 6 druhů a 5 stupňů dávají podle místa (zbraň, zbroj, šperk) různé bonusy; tři stejné se spojí ve vyšší stupeň. Při rozebrání předmětu se drahokamy vrátí.
- **Runy zbraní:** každá zbraň má runový soket (obouruční dva). Runa ohně, jedu, mrazu, bouře, krve, zkázy nebo upíra má podle stupně 10–50 % šanci při zásahu zapálit, otrávit, zmrazit, vyvolat blesk, způsobit krvácení, oslabit nebo vysát život.
- **Runy kouzel:** do každého kouzla jde vložit jednu z 12 run, která změní, jak funguje – ozvěna, rozštěpení, oheň, mráz, bouře, jed, síla, spěch, upír, průraz, navádění, výbuch. Spolu s legendárními schopnostmi a vlastnostmi šampionů tak každé patro hraje jinak.
- **Sady předmětů:** legendární kusy sad (od 10. patra) dávají bonusy za 2, 3 a 4 nasazené kusy.
- **Prokleté předměty:** občas vzácný předmět nese kletbu – obrovský bonus za cenu postihu (např. +80 % poškození a −30 % zdraví, nebo lektvary léčí jen napůl). V chrámu v Loppu jde kletbu zkrotit: zůstane 60 % bonusu a postih zmizí.
- **Transmutace:** u alchymisty (náhodně v kobkách nebo v laboratoři v Loppu) se 5 předmětů stejné kvality spojí v jeden – většinou o stupeň lepší, někdy o dva, výjimečně pradávný.
- **Kodex:** sbírka všeho nalezeného (unikáty, kusy sad, drahokamy, runy, druhy předmětů podle kvality) v Úspěších.
- **Automatická kořist:** pro každou kvalitu jde v pauze nastavit, jestli se předmět nechá, hned prodá, nebo rozebere. Předměty jde **zamknout**, aby je hromadný prodej ani rozebrání nevzaly.
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
- Klepnutí na nasazený slot (třeba helmu) ukáže všechny předměty z batohu, které se do něj vejdou, seřazené od nejlepšího – se šipkou ▲/▼ podle toho, jestli by byly lepší, a tlačítkem Nasadit. Klepnutí na řádek ukáže detail předmětu.
- Prodávat jde přímo z inventáře kdekoliv (vzácné a lepší předměty se nejdřív potvrdí). Předměty jde také řadit a rozebírat na materiály. Zelená šipka ▲ označuje předměty, které jsou lepší než nasazená výbava, a tlačítko „Nasadit lepší“ je nasadí jedním klepnutím.
- Sebrané předměty a materiály se ukazují v malém seznamu vlevo pod životy, oznámení o nové úrovni nahoře uprostřed.
- Obchodník:
  - náhodné zboží,
  - zpětný odkup omylem prodaných předmětů za stejnou cenu,
  - „tajemné zboží“ (zbraň tvého stylu, zbroj, šperk nebo cokoliv) neznámé kvality s velkou šancí na vzácný až mýtický předmět.
- Kovárna (kovadlina):
  - vylepšení +1 až +10 (šance na úspěch klesá s úrovní),
  - očarování, které přidá nebo přehodí magický efekt,
  - přehození jedné vlastnosti předmětu,
  - vrtání soketů.
- Chytrý loot: část zbraní padá podle typu útoku postavy a přednost mají prázdné sloty.

### Prostředí a průzkum
- **25 oblastí po 10 patrech**, každá s vlastními dlaždicemi, barvami, dekoracemi, počasím a dvěma rodinami nestvůr:
  - Kapitola I: Stará krypta, Jeskyně, Katakomby, Zatopené ruiny, Ledový dungeon,
  - Kapitola II: Démonické podzemí, Houbový les, Pavoučí hnízda, Hrobka pouštních králů, Kořeny světa,
  - Kapitola III: Krystalové jeskyně, Trpasličí síně, Kostnice, Zatopená katedrála, Brána podsvětí,
  - Kapitola IV: Popelavé pláně, Kovárny Pětice, Hnijící bažiny, Obsidiánová hlubina, Stínová citadela,
  - Kapitola V: Okraj prázdnoty, Plovoucí ostrovy, Zrcadlový palác, Hlubina snů, Dno světa.

  Na prvním patře oblasti ukáže karta patra její krátký popis a v Kronice se odemkne její úvodní scéna.
- Přechod do dalšího patra: postava dojde ke schodům a sejde po nich do tmy. Na černé obrazovce se objeví číslo patra, jméno oblasti a co na patře čeká (strážce, modifikátor, obchodník). Na novém patře postava sejde ze schodů, které vedou z patra nad ním. Klepnutím se dá karta zkrátit.
- **Výprava a desítky pater.** Brána do kobek v Loppu otevře výběr desítek (1–10, 11–20 …). U každé je nejhlubší dosažené patro, doporučená úroveň, bonus ke kořisti (+5 % za každou desítku) a strážce na jejím konci. Výprava začíná prvním patrem desítky; poražený strážce otevře další desítku. Běží vždy jen jedna výprava – začít jinou znamená tu rozběhnutou ukončit (hra se zeptá).
- **Tábor a checkpointy.** Páté patro každé desítky (5., 15., 35. …) je tábor: bezpečné patro bez nestvůr s ohništěm (plné zdraví a mana a na 5 minut +10 % poškození), obchodníkem, kovadlinou, alchymistou a truhlou společného úložiště. Na 25. a 125. patře je místo tábora příběhový strážce s přípravnou místností. Smrt vrací výpravu na poslední checkpoint – první patro desítky, tábor, nebo přípravnou místnost na patře strážce. Na lehké obtížnosti se patro jen opakuje.
- **Dveře.** Po patře se vybírá ze 2–3 dveří: nebezpečná cesta (o 35 % odolnější a o 25 % silnější nestvůry, víc šampionů, +60 % ke kořisti, víc zlata a zkušeností), běžná cesta nebo cesta k obchodníkovi, a neznámá oblast. Před táborem a strážcem žádné dveře nejsou.
- **Patra bez boje:** křižovatka obchodníků (obchodník, kovadlina, fontána, svatyně), pokladnice (truhly a zlato bez hlídek), síň hádanek (tabulka ukáže pořadí runových desek; špatný krok kousne bleskem, vyřešená hádanka vydá truhly) a místo setkání (věštkyně, hráči karet, oltáře, dopisy padlých).
- **Osudy pater.** Asi třetina běžných pater (na nebezpečné cestě víc) má osud, který se ukáže hned po příchodu a je napsaný pod jménem patra:
  - Temnota (větší tma, lepší kořist),
  - Krvavý měsíc (rychlejší a silnější nestvůry, víc zkušeností),
  - Dvojitá kořist,
  - Bez léčení (lektvary zdraví nepůsobí, žádná obnova zdraví; víc zlata a lepší kořist),
  - Invaze elit (třikrát víc šampionů),
  - Patro pokladů (truhly a zlato všude),
  - Zlatá horečka, Prokletí a Hordy.
- **Poslední šance.** Velmi vzácně (jednou za výpravu) nabídne obrazovka smrti boj v aréně: kdo 40 sekund vydrží proti sílícím vlnám, vrátí se do patra s jediným bodem zdraví. Prohra vrací na checkpoint.
- Mlha války s přímou viditelností: neprozkoumané části patra jsou černé.
- Velká mapa po klepnutí na minimapu (klávesa M). Když jsou objevené schody nebo obchodník mimo minimapu, ukazuje k nim šipka na jejím okraji.
- Rozbitné bedny, sudy a hliněné nádoby s drobnou kořistí. Bodcové pasti v chodbách a místnostech.
- Zlatý skřet: vzácný zloděj, který před hráčem utíká a po 18 sekundách zmizí portálem. Když ho chytíš, vysype hromadu zlata a vzácný předmět. Při Zlaté horečce se objevuje častěji.
- Úkol patra: každé běžné patro od druhého má jeden volitelný úkol podle toho, co v něm je:
  - poraz určitý počet nestvůr,
  - poraz šampiony,
  - otevři truhly,
  - rozbij bedny a nádoby,
  - prozkoumej 75 % patra.

  Postup ukazuje štítek pod kulatým tlačítkem s vykřičníkem mezi kouzly. Za splnění padne k hrdinovým nohám zlato, předmět, materiály a někdy paklíč.
- Prokletá truhla: vzácná černá truhla se zelenými runami. Po přijetí výzvy se 30 sekund kolem ní otevírají zelené portály s vlnami nestvůr. Nahoře běží čas a počet poražených. Na konci zbylé nestvůry zmizí a truhla se otevře; čím víc nestvůr padlo, tím víc předmětů v ní je (od 20 poražených i legendární nebo mýtický).
- Atmosféra oblastí: v kryptách poletuje prach, v jeskyních svítící spory, v ledu sněží, ve výhni stoupají jiskry, v zatopených místech kape voda, nad hrobkou fouká písek, pod kořeny světa padá listí, krystaly a zrcadla se třpytí, na popelavých pláních padá popel a v propasti blikají fialové jiskřičky. Úsporná grafika je vypne.
- Přes 70 úspěchů s odměnami (zlato, materiály, paklíče, body atributů). Na druhé záložce panelu úspěchů jsou statistiky postavy: herní čas, poražení nepřátelé a šampioni, sebrané zlato a předměty, nejlepší nález, nejsilnější zásah, splněné úkoly, prokleté truhly, mazlíčci, smrti a další.
- Barva kovu u zbraní a zbroje odpovídá materiálu předmětu (rezavý, železný, ocelový, runový, mithrilový, dračí, démonický, hvězdný). Vidět je to v inventáři i na zbrani v ruce postavy.

### Mazlíčci
V dungeonu čeká v klecích 8 zvířátek. První klec se objeví nejpozději ve 3. patře, další asi každých 10–15 pater (od patra, kde dané zvíře žije). Klec se pozná podle nápisu nad ní; stačí k ní dojít a otevřít ji. S hrdinou chodí vždy jeden mazlíček:

- sbírá kořist, která leží kolem (předměty, zlato i materiály mu přinese k nohám),
- dává svůj bonus,
- za každá 4 patra, která s hrdinou sestoupí, získá úroveň (nejvýš 10) a bonus roste.

| Mazlíček | Od patra | Co umí |
| --- | --- | --- |
| Kočka Mína | 3 | lepší kořist |
| Pes Ořech | 7 | kouše nepřátele vedle hrdiny, víc zdraví |
| Liška Zrzka | 12 | víc zlata |
| Sova Hú | 20 | víc zkušeností, odkrývá větší kus mapy |
| Želva Tonda | 32 | víc zdraví a blok |
| Sliz Bublina | 45 | vysávání života a obnova zdraví |
| Bludička Jiskra | 70 | silnější kouzla a rychlejší mana, svítí |
| Dráček Uhlík | 100 | plive oheň, kritické zásahy |

Létající mazlíčci (sova, bludička, dráček) se vznášejí nad zemí a když hrdina dlouho stojí, sova a dráček si sednou. Když hrdina odpočívá, mazlíček se prochází kolem, občas ukáže srdíčko a po delší době usne. Mazlíčky jde přepínat v pauze (Mazlíčci) nebo v okně postavy.

### Společníci, soupeři a nemesis
- **Žoldák:** v pauze jde najmout jednoho parťáka – tanka (provokuje nepřátele), léčitele, lučištníka nebo mága. Má vlastní sloty vybavení (zbraň, zbroj, šperk) a jednoduché rozkazy: útočit, bránit hrdinu, nebo jen následovat. Když padne, za chvíli vstane.
- **Dobrodruzi v kobkách:** občas patrem prochází jiný dobrodruh. Může se přidat (a u schodů dát dárek), nabídnout obchod, nebo chtít mýto a bojovat. Spojenec, kterému sebereš legendární kořist před nosem, se může obrátit proti tobě.
- **Nemesis:** šampion, který hrdinu zabije, může dostat jméno a titul („Grak, Zabiják Oviho“) a zesílit. Později se vrátí – a pokaždé, když znovu zvítězí, roste. Když ho konečně porazíš, padne bohatá kořist. Seznam nemesis je v Úspěších.

### Události v kobkách
Každé běžné patro má obvykle jednu až dvě náhodné události (na minimapě jako barevný kosočtverec):

- **Zajatci:** vesničané z Loppa (kovář, kupkyně, lovkyně, alchymistka, mág, mistr zbraní, kněžka) a cizí poutníci, které hlídají nestvůry. Osvobozený vesničan se vrátí domů a otevře v Loppu svou budovu; poutníci dají dárek (mapu patra, lektvary, zlato, předmět, zkušenosti, tajný průchod). Některý „zajatec“ ale může být převtělenec.
- **Oltáře:** krvavý (obětuj třetinu zdraví za +30 % poškození a +10 % kritické šance do konce patra), oltář proměny (polož předmět – často se vrátí o stupeň vzácnější) a oltář osudu (hod kostkami za zlato: požehnání, poklad, jackpot – nebo zkouška).
- **Duchové** padlých dobrodruhů: pomsti je (jejich vrah je vyznačený na mapě), nech si ukázat jejich skrýš, nebo je nech odpočívat.
- **Trhlina:** portál do zkřiveného světa plného nestvůr. Poraz jich dost, přivolej strážce trhliny a zabij ho – padne bohatá kořist (s bonusem za rychlost) a portál tě vynese o patro hlouběji.
- **Rvačka:** dvě smečky nestvůr bojují mezi sebou. Počkej, až se oslabí – vítězové jdou po tobě, ale nesou kořist poražených.
- **Krvavá výzva** (risk/reward): obelisk uprostřed místnosti. Po přijetí se místnost uzavře rudým světlem a přijdou dvě vlny silných nestvůr. Odměnou je krvavá truhla s +300 % šancí na legendární kořist.
- **Rozhodnutí s následky:** spoutaný nekromant Morvan (osvobodit / zabít / nechat), raněný rytíř Bertram (dát mu lektvar?) a démon v lahvi (splní přání…). Za pár pater se rozhodnutí vrátí – jako pomoc, zrada, společník, mrtvé tělo nebo vymahač dluhů.
- **Kostlivci u karet:** zahraj si o zlato.
- **Lore:** dopisy padlých dobrodruhů a nápisy na zdech (40 zápisků, některé prozradí tajný průchod). Přečtené se ukládají do Kroniky.
- **Velmi vzácné chvíle:** zlatá komnata plná pokladů, tajný strážce Aurex – Zlatý drak, zlatý portál do snového světa plného zlatých skřetů a zlatý déšť.

### Vesnice Loppo
Domov hrdiny pod širým nebem na úpatí Šedých hor. Dostaneš se tam z pauzy (🏠 Domů do Loppa – ne uprostřed boje) a zpět do kobek vede brána ve zřícenině starého hradu (patro pak začíná znovu od schodů). Vesnici obklopuje les: dlážděné cesty se sbíhají na kulatém náměstí se studnou, na severu stojí zřícenina hradu a zámek krále Dobromila s nádvořím a fontánou, na západě hřbitov s kaplí a hrobkou zakladatelů, na jihu rybník s mólem, kachnami a loďkou, zahrady se zeleninou a bylinkami, tržní stánky, lampy, lavičky a stromy. Den a noc se řídí hodinami hráče: v noci svítí lampy a okna, poletují světlušky a hřbitovem bloudí duch. Terén se kreslí na pozadí hned po spuštění hry, takže cesta domů nic nezdrží.

Ilda u studny řekne, kdo z vesničanů ještě chybí. Každý dům se otevře, až se jeho majitel vrátí z kobek, a dál roste za investované zlato (3 úrovně):

| Budova | Kdo | Co umí |
| --- | --- | --- |
| Tvůj dům | – | chalupa → dům → statek; truhla na 42 / 84 / 126 předmětů, postel (plné zdraví, +10 % zkušeností na 3–5 pater, na statku i +5 % poškození), stěna s trofejemi |
| Kovárna | kovář Bořek (od 3. patra) | kovadlina; v Loppu vyšší šance na vylepšení a levnější vylepšení a sokety |
| Obchod | kupkyně Šárka (od 5.) | 9 / 12 / 15 předmětů, s úrovní lepší zboží |
| Nástěnka úkolů | lovkyně Jitka (od 7.) | úkoly: 2 / 3 / 4 najednou, vyšší odměny |
| Laboratoř | alchymistka Vanda (od 9.) | transmutace, lektvary za 70 % ceny, silnější lektvary, transmutace bez nezdaru |
| Věž mága | mág Ignác (od 12.) | runy do zbraní (až 4. stupeň), runy kouzel, levnější zapomenutí talentů |
| Cvičiště | mistr Radovan (od 15.) | změna classy, +5 / +10 % zkušeností, silnější žoldák |
| Chrám | kněžka Bohdana (od 20.) | požehnání na 3–5 pater (síla, život, štěstí), krocení kleteb |

### Král Dobromil a královské úkoly
Před zámkem stojí král Dobromil III. se stráží. Dává jeden královský úkol po druhém: dvanáct úkolů, které vyprávějí příběh království (krysy pod trůnem, ztracený královský posel, dar pro pokladnici, šampioni, koruna předků, dar na hradby, tajemství starého hradu, poddaní v okovech, hrobka královského děda, trhlina v říši, zkouška krále bez lektvarů, hlubiny království), a pak nekonečné královské zakázky. Některé úkoly se plní v kobkách, jiné u krále: odevzdáš mu vzácný předmět nebo daruješ zlato. Za každý úkol dostaneš zlato, předmět a body přízně. Přízeň přináší pocty s trvalými bonusy:

| Pocta | Přízeň | Bonus |
| --- | --- | --- |
| Bronzová pečeť | 1 | +5 % zlata |
| Stříbrná pečeť | 3 | +5 % zkušeností |
| Zlatá pečeť | 6 | o úkol víc na nástěnce |
| Řád lva | 10 | +10 % magického nálezu |
| Koruna Loppa | 15 | +5 % poškození a královský dar – mýtická Koruna Loppa |

### Hřbitov
Hardcore hrdinové, kteří padli, mají na hřbitově u kaple vlastní hrob se svíčkou a náhrobkem (classa, úroveň, patro). Ostatní náhrobky patří vesničanům z minulých let.

### Úkoly
Na nástěnce v Loppu visí úkoly od vesničanů: najdi ztraceného dobrodruha (čeká jako zajatec na určeném patře), přines artefakt strážce, otevři prokletou hrobku, poraz strážce bez lektvarů, najdi tajné místnosti, poraz šampiony nebo nestvůry, osvoboď zajatce, přečti zápisky, zavři trhlinu a pomsti se nemesis. Najednou jich jde vzít 5, 7 nebo 10 (podle úrovně nástěnky). Splněný úkol se vyzvedne na nástěnce (zlato, předmět, drahokam, runa nebo materiál).

Deník úkolů se otevře kulatým tlačítkem s vykřičníkem vedle kouzel (nebo z pauzy); když čeká odměna nebo mapa pokladu, tlačítko zeleně pulzuje: nahoře hlavní úkol příběhu (další příběhový strážce a kapitola), pod ním úkol patra, vedlejší úkoly a mapy pokladů. Mapa pokladu občas leží v truhle (častěji ve zlaté), nosí ji šampion a skoro vždy zloděj. Přidá vedlejší úkol na jedno z dalších pater; tam na mapě i minimapě svítí zlatý křížek, kde se kope – vykopaná truhla dá předměty, zlato, drahokam a někdy runu. Najednou jdou nést 3 mapy.

### Ostatní
- Dynamické osvětlení s blikajícími pochodněmi, minimapa s mlhou války, čísla poškození, částicové efekty a otřesy obrazovky.
- Automatické ukládání do `localStorage`: při změně patra, každých 20 s a při odchodu z aplikace. K dispozici jsou 3 sloty pro různé postavy.
- Přenos postavy mezi zařízeními nebo prohlížeči: v menu Postavy tlačítko Přenést vytvoří textový kód a Vložit kód ho na jiném zařízení načte do volného slotu.
- Sklad (u obchodníků i v tvém domě v Loppu, 42–126 míst) pro předměty, které nechceš nosit ani prodat.
- Po smrti ukáže obrazovka, kdo zasadil poslední ránu a jak silnou, s tipem, jak se tomu příště vyhnout.
- Smrt znamená ztrátu části zlata a zkušeností (podle obtížnosti 5–25 % zlata) a návrat na checkpoint výpravy (začátek desítky, tábor, nebo přípravná místnost na patře strážce). V režimu Hardcore postava po smrti navždy zmizí.
- Lektvary mají krátké přebíjení (zdraví 4 s, mana 3 s), na tlačítku je vidět jako u kouzel.
- Tajemné zboží u obchodníka stojí zhruba trojnásobek toho, co v průměru dá, každý další kus u stejného obchodníka je o 40 % dražší a obchodník jich má jen čtyři.
- Nápověda na začátku hry. V pauze lze nastavit zvuk, hudbu, vibrace, velikost ovládání, automatické rozebírání slabých předmětů a úspornou grafiku (bez dynamického osvětlení, pro slabší telefony).
- Hlavní menu má živé pozadí, náhodně vygenerovaný dungeon s pochodněmi.
- Tlačítko Zpět na Androidu otevře pauzu místo opuštění hry.

## Struktura projektu

```
src/
  main.ts              konfigurace Phaseru
  data/                classy, kouzla, předměty, nepřátelé, drahokamy, runy, kletby, unikáty, talenty,
                       vesnice, úkoly, osudy, lore, bestiář, typy
  systems/             generátor dungeonu, stav postavy a ukládání, RNG, zvuk
  gfx/                 procedurální pixel-art (textury, ikony kouzel)
  game/                mapa a kolize, hráč, nepřátelé a spojenci, boj, kouzla, loot, AI bossů, efekty,
                       žoldák, události v kobkách (encounters), vesnice, úkoly
  scenes/              Boot, Game (hlavní herní smyčka), Gallery (náhled grafiky)
  ui/                  HTML/CSS rozhraní: HUD, joystick, inventář, postava, kouzla, obchod, menu,
                       budovy Loppa, nástěnka úkolů
  dev.ts               vývojářské nástroje (jen v dev režimu), včetně bota, který hru sám hraje
```

## Vývojářské nástroje

- `http://localhost:5173/?gallery` zobrazí všechny vygenerované textury.
- V dev režimu je v konzoli objekt `__dev`:
  - `__dev.start('mage', 30, 10)` spustí postavu na úrovni 30 v patře 10,
  - `__dev.castAll('mage')` sešle všechna kouzla classy,
  - `__dev.bot(true)` zapne bota, který hraje sám,
  - `__dev.speed(3)` zrychlí herní logiku,
  - `__dev.pets('owl')` dá postavě všechny mazlíčky a s sebou vezme sovu,
  - `__dev.ev('arena')` umístí na patro událost (`captive`, `altarBlood`, `ghost`, `portal`, `brawl`, `arena`, `necro`, `knight`, `bottle`, `cards`, `corpse`, `runes`, `golden`, `dragon`, `dream`, `rain`), `__dev.goTo('arena')` k ní přenese hrdinu,
  - `__dev.village()` přenese hrdinu do Loppa, `__dev.buildAll(3)` postaví všechny budovy na danou úroveň,
  - `__dev.quest('lost')` přijme úkol, `__dev.questInfo()` ukáže úkoly,
  - `__dev.elite('orc', ['štítonoš', 'zrcadlový'])` postaví vedle hrdiny šampiona s danými vlastnostmi,
  - `__dev.evInfo()` vypíše stav událostí patra.
