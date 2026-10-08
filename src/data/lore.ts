// Lore found in the dungeon: letters of those who went down before the hero, words cut into the walls
// and the stories of restless ghosts. Everything read is kept in the chronicle.
// Lines addressed to the hero avoid gendered verb forms (the hero can be anyone).

export interface LoreEntry {
  id: string;
  kind: 'note' | 'wall';
  title: string;
  text: string;
  /** only in this biome (0 dungeons, 1 caves, 2 ice, 3 forge, 4 abyss); anywhere when missing */
  biome?: number;
  /** reading it points at a secret wall of the floor */
  secret?: boolean;
}

export const LORE: LoreEntry[] = [
  // letters and notes of the dead
  { id: 'n_quake', kind: 'note', title: 'Dopis Martě', text: 'Marto, jestli tohle čteš, nečekej mě k večeři. Když se země otřásla, propadl jsem se do kobek i s vozem. Kůň utekl. Já už neuteču. – Tvůj Jarek' },
  { id: 'n_greed', kind: 'note', title: 'Poslední zápis kupce', text: 'Zlato. Tolik zlata v jedné truhle! Ještě nikdy jsem neviděl truhlu, která by se tak zubila. A proč dýchá…' },
  { id: 'n_map', kind: 'note', title: 'Ohořelá mapa', text: 'Na mapě je zakreslená cesta dolů a vedle ní poznámka: „Každé páté patro hlídá strážce. Nechoď tam bez lektvarů. A když zčervená země, uhni.“' },
  { id: 'n_bet', kind: 'note', title: 'Sázka', text: 'Vsadil jsem se s Ondrou, že dojdu do dvacátého patra. Jsem v devátém a došel mi chleba. Ondro, vyhráls. Pivo ti dlužím na věčnost.' },
  { id: 'n_prayer', kind: 'note', title: 'Modlitba poutníka', text: 'Světlo nahoře, nezapomeň na nás dole. Ilda říká, že pečeť drží. Já jí věřím. Jen kdyby tak strašně nepraskala.' },
  { id: 'n_goblin', kind: 'note', title: 'Gobliní dlužní úpis', text: 'Dlužník: Bertík Hrbáček. Dluh: 3 kozy, 1 kotel, 14 zlatých. Úrok: jedna ruka. Splatné ihned. – Gobliní spořitelna, pobočka Kobky' },
  { id: 'n_merc', kind: 'note', title: 'Smlouva žoldnéře', text: 'Za 200 zlatých doprovodím pána do hlubin a zpět. Zpáteční cesta se platí předem. (Poznámka na okraji: zatím nikdo nezaplatil zpáteční.)' },
  { id: 'n_child', kind: 'note', title: 'Dětská kresba', text: 'Na pomačkaném papíře je nakreslená lucerna, usměvavé slunce a velkými písmeny: TATÍNKU, VRAŤ SE.' },
  { id: 'n_recipe', kind: 'note', title: 'Recept na lektvar', text: 'Tři kapky slizu, kořen jeskynní houby, špetka popela. NEPŘIDÁVAT netopýří křídla. (Přidal jsem je. Proto tu teď ležím.)' },
  { id: 'n_thief', kind: 'note', title: 'Lovcova chlouba', text: 'Viděl jsem zlatého skřeta! Nesl pytel větší než on sám. Až ho chytím, budu boháč. Stačí jen být rychlejší než… au.' },
  { id: 'n_five', kind: 'note', title: 'Zápisky učence', text: 'Pětice: Bořiv kovář, Isolda Ledová, Radim Štítonoš, Vesna Světlonoška a Kael Bezejmenný. O posledním z nich nevíme vůbec nic. Ani jak vypadal. Ani jak zemřel. Proč?' },
  { id: 'n_elara', kind: 'note', title: 'Vzkaz na kameni', text: 'Kdo najde tento vzkaz: jsem v pořádku a jdu dál dolů. Mamince vyřiďte, ať se nebojí. – E.', biome: 0 },
  { id: 'n_coward', kind: 'note', title: 'Útěk', text: 'Otočil jsem se a utíkal. Ostatní zůstali. Ten řev budu slyšet do konce života. Asi to nebude dlouho.' },
  { id: 'n_cook', kind: 'note', title: 'Kuchařka z hlubin', text: 'Netopýr na rožni: chutná jako kuře. Zombie: chutná jako zklamání. Sliz: nechutná vůbec, ale zasytí na tři dny.' },
  { id: 'n_last', kind: 'note', title: 'Poslední vůle', text: 'Jestli mě někdo najde, vezměte si moji výbavu. Mně už k ničemu není a vám by mohla zachránit život. A pozdravujte Loppo.' },
  { id: 'n_love', kind: 'note', title: 'Milostný dopis', text: 'Milá Aničko, tady dole je pořád tma, ale když na tebe myslím, je o kousek světleji. Až se vrátím, vezmu si tě. Slibuju.' },
  { id: 'n_villagers', kind: 'note', title: 'Seznam ztracených', text: 'Kovář Bořek. Kupkyně Šárka. Lovkyně Jitka. Alchymistka Vanda. Mág Ignác. Mistr Radovan. Kněžka Bohdana. Všechny je odvlekly nestvůry. Kdo je najde, ať je vrátí domů.' },
  { id: 'n_merchant', kind: 'note', title: 'Kupcova účtenka', text: 'Prodáno: 1 lektvar zdraví. Cena: 25 zlatých. Kupující: dobrodruh. Datum: před sto lety. Podpis: Kupec. (Ten kupec, co tu obchoduje dodnes?)' },
  // the caves
  { id: 'c_spores', kind: 'note', title: 'Varování sběrače', text: 'Houby, které svítí zeleně, se dají jíst. Ty, které svítí fialově, jedí tebe.', biome: 1 },
  { id: 'c_river', kind: 'note', title: 'Podzemní řeka', text: 'Řeka tu teče do kopce. Nebo jsem se zbláznil. Možná obojí. Elara prý tudy obešla Matku spor.', biome: 1 },
  { id: 'c_breath', kind: 'note', title: 'Dech hory', text: 'V noci – jestli tu vůbec je noc – slyším, jak hora dýchá. Nádech. Výdech. Nádech…', biome: 1 },
  // the ice
  { id: 'i_frozen', kind: 'note', title: 'Zamrzlý deník', text: 'Prsty už necítím. Isolda se na mě dívala zpoza ledu. Neubližovala. Jen se dívala. Tak smutně.', biome: 2 },
  { id: 'i_bell', kind: 'note', title: 'Ledové zvony', text: 'Každý krok tu zní jako zvon. Proto se tu chodí po špičkách. Nestvůry slyší úplně všechno.', biome: 2 },
  { id: 'i_tears', kind: 'note', title: 'Slzy z ledu', text: 'Našel jsem zmrzlé slzy ve tvaru perel. Prodal bych je za majlant, jen kdybych se odsud dostal.', biome: 2 },
  // the forge
  { id: 'f_anvil', kind: 'note', title: 'Kovářská pověst', text: 'Bořiv kul pečeť sedm dní a sedm nocí. Pak odložil kladivo a řekl: „Teď už je to na vás.“ A odešel do plamenů.', biome: 3 },
  { id: 'f_heat', kind: 'note', title: 'Ohořelý list', text: 'Je tu takové horko, že se mi vypařil i strach. Zbyla jen žízeň.', biome: 3 },
  { id: 'f_chains', kind: 'note', title: 'Řetězy', text: 'Řetězy na zdech jsou ještě teplé. Kdo je tu držel? A kam se poděl?', biome: 3 },
  // the abyss
  { id: 'a_whisper', kind: 'note', title: 'Šepot', text: 'Neposlouchej ten hlas. Neposlouchej ten hlas. Neposlouchej ten hlas. Neposlouchej…', biome: 4 },
  { id: 'a_stars', kind: 'note', title: 'Hvězdy pod zemí', text: 'Tady dole jsou hvězdy. Ale nejsou to hvězdy. Mrkají.', biome: 4 },
  { id: 'a_end', kind: 'note', title: 'Konec cesty', text: 'Došel jsem dál než kdokoli přede mnou. A víte co? Dno nemá dno.', biome: 4 },
  // cut into the walls
  { id: 'w_five', kind: 'wall', title: 'Znak Pětice', text: 'Pět kruhů spojených řetězem. Pod nimi: „Co jsme spoutali, nesmí být probuzeno.“' },
  { id: 'w_count', kind: 'wall', title: 'Čárky', text: 'Stovky čárek, vždy po pěti. Vězeň tu počítal dny. Poslední skupinka má jen čtyři.' },
  { id: 'w_warning', kind: 'wall', title: 'Varování', text: 'Krví napsáno: „NEOTVÍREJ ČERNÉ TRUHLY.“ A o kus níž jiným písmem: „…ledaže máš dost odvahy. Pak je otevři všechny.“' },
  { id: 'w_secret', kind: 'wall', title: 'Šipka', text: 'Vyrytá šipka a slova: „Zeď tu nekončí. Klepej.“ Šipka míří k místu, kde ve zdi vede tajný průchod.', secret: true },
  { id: 'w_mason', kind: 'wall', title: 'Tajemství zedníka', text: '„Postavil jsem tu zeď na příkaz pána. Za ní je jeho poklad. Pán je mrtvý. Poklad ne.“ Vedle je načrtnuto, kde zeď hledat.', secret: true },
  { id: 'w_kael', kind: 'wall', title: 'Jméno', text: 'Jediné slovo, vyškrábané nehty hluboko do kamene: KAEL.' },
  { id: 'w_morgrim', kind: 'wall', title: 'Brána', text: '„Strážce bran nespí. Strážce bran čeká.“', biome: 0 },
  { id: 'w_pepa', kind: 'wall', title: 'Nápis', text: '„Byl tu Pepa.“ A pod tím jiným písmem: „Pepa tu pořád je.“' },
  { id: 'w_heart', kind: 'wall', title: 'Srdce', text: 'Vyryté srdce a v něm dvě jména: Ilda a Tomáš. Kámen je kolem ohlazený, jako by se ho někdo často dotýkal.' },
  { id: 'w_lantern', kind: 'wall', title: 'Lucerna', text: '„Dokud svítí lucerna, nikdo tu není sám.“' },
];

export const LORE_BY_ID: Record<string, LoreEntry> = Object.fromEntries(LORE.map((l) => [l.id, l]));

/** a piece of lore for a floor: unread ones first, of its biome or of any */
export function pickLore(read: string[], biome: number, kind: LoreEntry['kind'], wantSecret = false): LoreEntry | null {
  const fit = LORE.filter((l) => l.kind === kind && (l.biome === undefined || l.biome === biome) && (!l.secret || wantSecret));
  const fresh = fit.filter((l) => !read.includes(l.id));
  const pool = fresh.length ? fresh : fit;
  if (!pool.length) return null;
  // a secret hint goes first when the floor has a hidden room
  const hint = wantSecret ? pool.filter((l) => l.secret) : [];
  const from = hint.length && Math.random() < 0.6 ? hint : pool;
  return from[Math.floor(Math.random() * from.length)];
}

// ---------------------------------------------------------------- ghosts
export interface GhostDef {
  name: string;
  /** genitive ("Viléma") for the murderer's name */
  gen: string;
  fem?: boolean;
  story: string;
}

export const GHOSTS: GhostDef[] = [
  { name: 'Sir Vilém', gen: 'sira Viléma', story: 'Byl jsem rytíř. Přísahal jsem, že dojdu na dno a obnovím pečeť. Došel jsem jen sem. Zabila mě bestie, která pořád bloudí tímhle patrem.' },
  { name: 'Lovkyně Bára', gen: 'lovkyně Báry', fem: true, story: 'Sto zlatých za každou hlavu, říkali. Nikdo neříkal, že některé hlavy kousnou zpátky. Můj vrah tu někde pořád číhá.' },
  { name: 'Mistr Kryštof', gen: 'mistra Kryštofa', story: 'Studoval jsem pečeť třicet let. Přišel jsem ji opravit a skončil jako duch v kobce. Ironie, že? Ta věc, co mě zabila, je pořád blízko.' },
  { name: 'Hostinský Lojza', gen: 'hostinského Lojzy', story: 'Šel jsem dolů jen pro sud vína, který mi odkutálel do sklepa. Sklep vedl dál, než jsem čekal. Mnohem dál. A něco tam na mě čekalo.' },
  { name: 'Kněz Benedikt', gen: 'kněze Benedikta', story: 'Nesl jsem světlo do tmy. Tma ho sfoukla. To, co mě zabilo, se tu prochází, jako by mu patřil svět.' },
  { name: 'Zlodějka Vrána', gen: 'zlodějky Vrány', fem: true, story: 'Ukradla jsem toho tolik… a nakonec mi ukradli život. Ten zloděj chodí po tomhle patře. Ale můj poklad nenašel nikdo.' },
  { name: 'Panoš Matěj', gen: 'panoše Matěje', story: 'Měl jsem jen nosit pánovi štít. Pán utekl. Štít jsem nesl dál, dokud mě nedostihli. Jeden z nich tu pořád je.' },
  { name: 'Bylinkářka Rozárka', gen: 'bylinkářky Rozárky', fem: true, story: 'Hledala jsem tu vzácné houby na lék pro syna. Našla jsem je. Domů jsem už nedošla. To, co mě zabilo, tu pořád slídí.' },
];
