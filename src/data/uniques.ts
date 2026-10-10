// Legendary uniques: every legendary (and better) item is one of these named pieces with a power of its
// own - not just bigger numbers. Powers are special effects (see SPECIALS in items.ts) handled in Combat,
// Player, Spells and Loot. Found uniques are recorded in the codex.

export interface PowerDef {
  id: string;
  desc: string;
}

/** the unique powers (they never roll as random specials) */
export const POWERS: PowerDef[] = [
  { id: 'ricochet', desc: 'Tvé střely se po zásahu odrazí ke dvěma dalším nepřátelům' },
  { id: 'splitShot', desc: 'Šíp se po zásahu rozštěpí na tři' },
  { id: 'soulRise', desc: 'Zabití nepřátelé mají 25% šanci povstat jako tvůj stín (15 s)' },
  { id: 'cheatDeath', desc: 'Jednou za 60 s tě smrtelný úder nezabije – zůstaneš na 30 % zdraví' },
  { id: 'phoenix', desc: 'Jednou za patro vstaneš z mrtvých s polovinou zdraví a vše kolem spálíš' },
  { id: 'meteorCrit', desc: 'Kritické zásahy mají 20% šanci přivolat meteor' },
  { id: 'frostArmor', desc: 'Při zásahu 15% šance na mrazivou novu, která zmrazí okolí' },
  { id: 'whirl', desc: 'Každý čtvrtý útok je vír, který zasáhne vše kolem tebe' },
  { id: 'stormAura', desc: 'Každou sekundu udeří blesk do nepřítele poblíž' },
  { id: 'executioner', desc: 'Nepřátelé pod 25 % zdraví dostávají trojnásobné poškození (strážci 1,5×)' },
  { id: 'giantSlayer', desc: '+50 % poškození šampionům a strážcům' },
  { id: 'arcaneFlow', desc: 'Kouzla stojí o 30 % méně many a každé tě vyléčí o 3 %' },
  { id: 'timeWarp', desc: 'Přebíjení kouzel běží o 25 % rychleji' },
  { id: 'bloodShield', desc: 'Každé zabití ti dá štít za 5 % zdraví (až 30 %)' },
  { id: 'midas', desc: 'Nestvůry upustí 3× víc zlata a šampioni často drahokam' },
  { id: 'stoneSkin', desc: 'Když stojíš na místě, dostáváš o 30 % méně poškození' },
  { id: 'bloodlust', desc: 'Každé zabití ti na 6 s zrychlí útoky o 6 % (až desetkrát)' },
  { id: 'spiritWolves', desc: 'Každých 15 s v boji přivoláš dva duchovní vlky' },
  { id: 'orbitBlades', desc: 'Kolem tebe krouží tři přízračné čepele' },
  { id: 'frostAura', desc: 'Nepřátelé těsně u tebe mrznou a jsou zpomalení' },
  { id: 'fireTrail', desc: 'Kudy jdeš, tudy hoří země pod nepřáteli' },
  { id: 'reflect', desc: '25% šance odrazit nepřátelskou střelu zpět (dvojnásobnou silou)' },
  { id: 'secondWind', desc: 'Pod 30 % zdraví se ti jednou za 30 s vrátí 35 % zdraví' },
  { id: 'markOfDeath', desc: 'Zásah označí nepřítele: od všech bere o 25 % víc poškození' },
  { id: 'starfall', desc: 'Každých 8 s dopadnou hvězdy na nepřátele kolem tebe' },
  { id: 'echoStrike', desc: 'Útoky se po chvíli zopakují jako přízračná ozvěna (50 % poškození)' },
  { id: 'luckyStar', desc: '+40 % šance na lepší kořist a truhly dají předmět navíc' },
  { id: 'lifeTap', desc: 'Kritický zásah tě vyléčí o 5 % zdraví' },
  { id: 'thunderClap', desc: 'Úhyb nebo blok vyšle kolem tebe hromovou vlnu' },
  { id: 'berserkRoar', desc: 'Pod 50 % zdraví na 5 s získáš +40 % poškození (jednou za 20 s)' },
  { id: 'thornAura', desc: 'Trny zasáhnou i střelce a mágy (poloviční silou) a nepřátelé těsně u tebe je dostávají každou sekundu' },
  { id: 'thornArmor', desc: 'Brnění se mění v ostny: trny jsou silnější o čtvrtinu tvého brnění v procentech' },
];

export const POWER_BY_ID = Object.fromEntries(POWERS.map((p) => [p.id, p])) as Record<string, PowerDef>;

export interface UniqueDef {
  id: string;
  name: string;
  base: string;
  power: string;
  lore: string;
}

export const UNIQUES: UniqueDef[] = [
  // weapons
  { id: 'deathwhisper', name: 'Šepot smrti', base: 'dagger', power: 'executioner', lore: 'Čepel, která ví, kdy je konec.' },
  { id: 'kingsbane', name: 'Zhouba králů', base: 'greatsword', power: 'giantSlayer', lore: 'Kována na tyrany a jejich strážce.' },
  { id: 'widowcry', name: 'Pláč vdov', base: 'sword', power: 'soulRise', lore: 'Kdo jí padne, slouží dál.' },
  { id: 'shadowthorn', name: 'Stínotrn', base: 'bow', power: 'ricochet', lore: 'Šíp z něj nikdy nekončí v prvním těle.' },
  { id: 'thunderer', name: 'Hromobijec', base: 'hammer', power: 'meteorCrit', lore: 'Co udeří, na to spadne nebe.' },
  { id: 'justice', name: 'Žhnoucí spravedlnost', base: 'mace', power: 'echoStrike', lore: 'Každý trest zazní dvakrát.' },
  { id: 'bonebreaker', name: 'Kostilam', base: 'greataxe', power: 'whirl', lore: 'Točí se jako mlýnský kámen.' },
  { id: 'ghostquake', name: 'Duchotřas', base: 'staff', power: 'starfall', lore: 'Hvězdy poslouchají toho, kdo ji drží.' },
  { id: 'starshard', name: 'Hvězdný úlomek', base: 'wand', power: 'arcaneFlow', lore: 'Mana z ní teče jako voda.' },
  { id: 'bloodmoon', name: 'Krvavý půlměsíc', base: 'axe', power: 'bloodlust', lore: 'Čím víc krve, tím rychlejší ruka.' },
  { id: 'lastword', name: 'Poslední slovo', base: 'crossbow', power: 'splitShot', lore: 'Jedna šipka, tři rány.' },
  { id: 'dragonslayer', name: 'Drakobijec', base: 'spear', power: 'giantSlayer', lore: 'Hrot zakalený v dračí krvi.' },
  { id: 'spiderfang', name: 'Pavoučí tesák', base: 'dagger', power: 'markOfDeath', lore: 'Jed, který ukazuje cestu dalším ranám.' },
  { id: 'echoages', name: 'Ozvěna věků', base: 'sword', power: 'echoStrike', lore: 'Každý sek se vrací z minulosti.' },
  { id: 'thirstblade', name: 'Žíznivá čepel', base: 'sword', power: 'lifeTap', lore: 'Pije jen z nejhlubších ran.' },
  { id: 'redstorm', name: 'Rudá bouře', base: 'greataxe', power: 'berserkRoar', lore: 'Zuřivost, která se probouzí v krvi.' },
  { id: 'shadowhunter', name: 'Lovec stínů', base: 'bow', power: 'markOfDeath', lore: 'Kdo je označen, ten už neuteče.' },
  { id: 'comet', name: 'Kometa', base: 'staff', power: 'meteorCrit', lore: 'Ohnivý ocas hvězdy zkrocený v holi.' },
  { id: 'wintercane', name: 'Hůl věčného ledu', base: 'staff', power: 'frostAura', lore: 'Kolem ní neroztaje ani dech.' },
  { id: 'mountainfist', name: 'Pěst hory', base: 'knuckle', power: 'echoStrike', lore: 'Ráz, který se vrací jako lavina.' },
  { id: 'stormwand', name: 'Bouřná hůlka', base: 'wand', power: 'stormAura', lore: 'Jiskry z ní skáčou samy.' },
  { id: 'sistercross', name: 'Sestřin kříž', base: 'crossbow', power: 'ricochet', lore: 'Šipky se vracejí pro další oběti.' },
  { id: 'smithhammer', name: 'Kladivo kovářů', base: 'hammer', power: 'whirl', lore: 'Tisíc úderů na kovadlinu, tisíc na nepřátele.' },
  { id: 'moonsickle', name: 'Měsíční srp', base: 'axe', power: 'executioner', lore: 'Sklízí to, co už dozrálo ke smrti.' },
  { id: 'wolfspear', name: 'Kopí smečky', base: 'spear', power: 'spiritWolves', lore: 'Vlci jdou tam, kam ukáže hrot.' },
  { id: 'vampknuckle', name: 'Upíří kastet', base: 'knuckle', power: 'lifeTap', lore: 'Každý tvrdý úder vrací sílu.' },
  { id: 'bloodsword', name: 'Krvavá přísaha', base: 'greatsword', power: 'bloodShield', lore: 'Krev nepřátel se mění ve tvou zbroj.' },
  { id: 'gravecaller', name: 'Hrobník', base: 'staff', power: 'soulRise', lore: 'Mrtví mu odpovídají.' },
  { id: 'arrowstorm', name: 'Bouře šípů', base: 'compoundbow', power: 'splitShot', lore: 'Tři šípy – a z každého další tři.' },
  { id: 'sparrow', name: 'Vrabčí let', base: 'shortbow', power: 'bloodlust', lore: 'Šíp letí dřív, než stihneš mrknout.' },
  { id: 'hawkeye', name: 'Sokolí oko', base: 'longbow', power: 'executioner', lore: 'Z dálky vidí, kdo už padá.' },
  { id: 'ironrain', name: 'Železný déšť', base: 'repeater', power: 'ricochet', lore: 'Šipky neznají odpočinek.' },
  { id: 'vipertongue', name: 'Zmijí jazyk', base: 'handcrossbow', power: 'markOfDeath', lore: 'Kousne a ukáže cestu dalším ranám.' },
  { id: 'bladedance', name: 'Tanec čepelí', base: 'throwknives', power: 'orbitBlades', lore: 'Nože, které se nikdy nevrátí do pochvy.' },
  { id: 'northwrath', name: 'Hněv severu', base: 'throwaxes', power: 'berserkRoar', lore: 'Hněv, který se dá hodit.' },
  { id: 'lightbearer', name: 'Světlonoš', base: 'scepter', power: 'secondWind', lore: 'Světlo neopouští ty, kdo vytrvají.' },
  { id: 'thundervoice', name: 'Hlas hromu', base: 'stormstaff', power: 'stormAura', lore: 'Kde promluví, tam udeří blesk.' },
  { id: 'forestheart', name: 'Srdce hvozdu', base: 'crook', power: 'spiritWolves', lore: 'Hvozd posílá své strážce.' },
  { id: 'waspsting', name: 'Vosí žihadlo', base: 'rapier', power: 'lifeTap', lore: 'Bodne, napije se a je pryč.' },
  { id: 'desertwind', name: 'Pouštní vichr', base: 'scimitar', power: 'whirl', lore: 'Točí se jako písečná bouře.' },
  { id: 'penance', name: 'Řetěz pokání', base: 'flail', power: 'giantSlayer', lore: 'Čím větší hříšník, tím tvrdší trest.' },
  { id: 'wolfclaw', name: 'Vlčí spár', base: 'claws', power: 'bloodlust', lore: 'Čím víc krve, tím divočejší.' },
  { id: 'castleguard', name: 'Hradní stráž', base: 'halberd', power: 'stoneSkin', lore: 'Stráž, která neustoupí ani o píď.' },
  { id: 'soulreaper', name: 'Žnec duší', base: 'scythe', power: 'soulRise', lore: 'Co pokosí, to znovu vstane – na tvé straně.' },
  { id: 'stillwater', name: 'Tichá voda', base: 'quarterstaff', power: 'thunderClap', lore: 'Uhni – a hora odpoví.' },
  // armour
  { id: 'eternalnight', name: 'Plášť věčné noci', base: 'chest', power: 'phoenix', lore: 'Kdo ho nosí, vstává z popela.' },
  { id: 'deepguard', name: 'Strážce hlubin', base: 'shield', power: 'reflect', lore: 'Vrací každou střelu tomu, kdo ji vyslal.' },
  { id: 'titanskin', name: 'Kůže titána', base: 'chest', power: 'stoneSkin', lore: 'Stůj pevně a nic tě nepohne.' },
  { id: 'wyrmscale', name: 'Šupiny wyrma', base: 'chest', power: 'frostArmor', lore: 'Mrazivý dech drakova srdce.' },
  { id: 'gatekeeper', name: 'Obránce bran', base: 'shield', power: 'bloodShield', lore: 'Každý padlý nepřítel posílí hradbu.' },
  { id: 'mistveil', name: 'Závoj mlhy', base: 'helmet', power: 'timeWarp', lore: 'Čas v mlze plyne jinak.' },
  { id: 'ironoath', name: 'Železná přísaha', base: 'pants', power: 'stoneSkin', lore: 'Neustoupím ani o krok.' },
  { id: 'mountainbreath', name: 'Dech hor', base: 'helmet', power: 'stormAura', lore: 'Na vrcholcích hor se rodí bouře.' },
  { id: 'sevenleague', name: 'Sedmimílové boty', base: 'boots', power: 'fireTrail', lore: 'Kde došlápnou, tam zůstane žár.' },
  { id: 'wintersteps', name: 'Kroky zimy', base: 'boots', power: 'frostAura', lore: 'Mráz chodí s tebou.' },
  { id: 'giantbelt', name: 'Opasek obra', base: 'belt', power: 'secondWind', lore: 'Obr se nevzdává ani na kolenou.' },
  { id: 'miserbelt', name: 'Pás lakomce', base: 'belt', power: 'midas', lore: 'Zlato k němu samo leze.' },
  { id: 'madcrown', name: 'Koruna šílence', base: 'helmet', power: 'berserkRoar', lore: 'Bolest jen přilévá olej do ohně.' },
  { id: 'wolfhide', name: 'Vlčí kožich', base: 'pants', power: 'spiritWolves', lore: 'Smečka cítí svého vůdce.' },
  { id: 'thundershield', name: 'Hromový štít', base: 'shield', power: 'thunderClap', lore: 'Každý odražený úder zahřmí.' },
  { id: 'nimbleboots', name: 'Boty mrštného', base: 'boots', power: 'thunderClap', lore: 'Kdo uhne, ten udeří.' },
  { id: 'bladecloak', name: 'Plášť čepelí', base: 'chest', power: 'orbitBlades', lore: 'Čepele tančí kolem nositele.' },
  { id: 'firewalker', name: 'Žhavé šlapky', base: 'boots', power: 'fireTrail', lore: 'Po tobě zůstává jen popel.' },
  { id: 'spikedplate', name: 'Ostnatý krunýř', base: 'chest', power: 'thornArmor', lore: 'Kdo do něj udeří, ten krvácí.' },
  { id: 'thorncrown', name: 'Trnová koruna', base: 'helmet', power: 'thornAura', lore: 'Bolest, kterou neseš, rozdáváš dál.' },
  { id: 'hedgehog', name: 'Ježek', base: 'shield', power: 'thornAura', lore: 'Štít, na který se nikdo nesahá dvakrát.' },
  // jewellery and off-hand
  { id: 'stormeye', name: 'Oko bouře', base: 'amulet', power: 'stormAura', lore: 'V jeho středu je ticho, kolem blesky.' },
  { id: 'dragonheart', name: 'Srdce draka', base: 'amulet', power: 'secondWind', lore: 'Bije dál, i když už nemá.' },
  { id: 'goddesstear', name: 'Slza bohyně', base: 'ring', power: 'cheatDeath', lore: 'Jednou za čas tě bohyně nenechá padnout.' },
  { id: 'fatering', name: 'Kruh osudu', base: 'ring', power: 'luckyStar', lore: 'Osud ti přeje víc než ostatním.' },
  { id: 'lichseal', name: 'Pečeť lichů', base: 'ring', power: 'arcaneFlow', lore: 'Lichové nikdy nešetří mocí.' },
  { id: 'oldmemory', name: 'Prastará vzpomínka', base: 'amulet', power: 'timeWarp', lore: 'Vzpomínka na čas, kdy hodiny stály.' },
  { id: 'martyrblood', name: 'Krev mučedníka', base: 'bracer', power: 'orbitBlades', lore: 'Obětovaná krev se stala ostřím.' },
  { id: 'northstar', name: 'Hvězda severu', base: 'amulet', power: 'starfall', lore: 'Ukazuje cestu – a padá na nepřátele.' },
  { id: 'kingring', name: 'Zlatý prsten krále', base: 'ring', power: 'midas', lore: 'Král nikdy neodešel s prázdnou.' },
  { id: 'packbracer', name: 'Náramek smečky', base: 'bracer', power: 'spiritWolves', lore: 'Vytí slyšíš, i když kolem nikdo není.' },
  { id: 'lastchance', name: 'Amulet poslední šance', base: 'amulet', power: 'cheatDeath', lore: 'Pro chvíle, kdy už není kam couvnout.' },
  { id: 'ancientorb', name: 'Koule pradávných', base: 'orb', power: 'arcaneFlow', lore: 'Pamatuje si první kouzlo světa.' },
  { id: 'stormorb', name: 'Bouřná koule', base: 'orb', power: 'starfall', lore: 'Uvnitř se převalují hvězdy.' },
  { id: 'mirrorbracer', name: 'Zrcadlový náramek', base: 'bracer', power: 'reflect', lore: 'Ukáže střelci jeho vlastní tvář.' },
  { id: 'luckybracer', name: 'Náramek štěstěny', base: 'bracer', power: 'luckyStar', lore: 'Štěstí přeje připraveným.' },
];

export const UNIQUE_BY_ID = Object.fromEntries(UNIQUES.map((u) => [u.id, u])) as Record<string, UniqueDef>;

/** the uniques of a base type (for a legendary of a given kind) */
export function uniquesFor(base: string) {
  return UNIQUES.filter((u) => u.base === base);
}
