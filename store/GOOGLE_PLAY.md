# Deepwick na Google Play

Aplikace pro Android je hotová. Je to hra zabalená přes Capacitor: soubory hry jsou přímo v aplikaci, takže běží i bez internetu (kromě společné hry). Nákupy perel jdou přes platby Google Play.

## Co je připravené

| Soubor | K čemu je |
|---|---|
| `app-release.aab` | Balík, který se nahrává do Google Play (vzniká v `android/app/build/outputs/bundle/release/`). |
| `app-release.apk` | Stejná hra jako instalační soubor. Dá se nahrát přímo do telefonu a vyzkoušet. |
| `deepwick-upload.jks` a `keystore.properties` | Podpisový klíč a jeho hesla. Podepisuje se jím každá verze, i všechny budoucí aktualizace. Ulož si ho bezpečně (třeba na dvě místa) a nikomu ho nedávej. Do repozitáře nepatří. |
| `store/README.md` | Název, krátký a dlouhý popis hry česky a anglicky. |
| `store/feature.png`, `store/feature_en.png` | Grafika pro Google Play (1024 × 500). |
| `store/screenshots/` | Snímky obrazovky 1920 × 1080: `cs_*` česky, `en_*` anglicky. |
| `public/icons/icon-512.png` | Ikona aplikace pro obchod (512 × 512). |

Aplikace je na šířku, na celou obrazovku a bez lišt telefonu. ID aplikace je `cz.deepwick.game`, verze 1.0.0 (kód verze 10000).

## Než začneš

1. Doplň svoje údaje do `public/privacy.html` a `public/terms.html` (místa ⟦…⟧: jméno nebo firma, adresa, e-mail). Pak se musí nasadit web (`bash tools/deploy.sh`). Google chce odkaz na zásady ochrany soukromí: https://oviiicek.github.io/loppo/privacy.html.
2. Připrav si e-mail pro hráče. Google ho ukazuje u hry.
3. Najdi aspoň 12 lidí s Androidem (kamarády, rodinu), kteří hru budou 14 dní testovat. Nový osobní účet vývojáře totiž může hru vydat pro všechny až po takovém testu.

## 1. Účet vývojáře

1. Otevři https://play.google.com/console a přihlas se Google účtem.
2. Zvol typ účtu (osobní, nebo organizace, pokud máš firmu) a zaplať jednorázový poplatek 25 dolarů.
3. Ověř svou totožnost podle pokynů Googlu (doklad, telefon). Může to trvat pár dní.

## 2. Nová aplikace

V Play Console klikni na **Vytvořit aplikaci**:

- název: `Deepwick: Nekonečný dungeon`,
- výchozí jazyk: čeština,
- aplikace nebo hra: **Hra**,
- zdarma, nebo placená: **Zdarma** (nákupy v aplikaci to nevylučují),
- potvrď prohlášení (zásady pro vývojáře, exportní předpisy).

## 3. Nastavení aplikace

Na hlavní stránce aplikace je seznam úkolů **Nastavení aplikace**. Odpovědi pro Deepwick:

- **Zásady ochrany soukromí:** https://oviiicek.github.io/loppo/privacy.html
- **Přístup k aplikaci:** všechny funkce jsou dostupné bez přihlášení.
- **Reklamy:** aplikace neobsahuje reklamy.
- **Hodnocení obsahu** (dotazník IARC), kategorie Hra:
  - násilí: fantasy boj s nestvůrami v pixelové grafice, bez realistického násilí na lidech,
  - nic sexuálního, žádné vulgarity, drogy ani hazard o skutečné peníze,
  - nákupy v aplikaci: ano, digitální zboží,
  - hráči spolu můžou hrát (společná hra přes kód), ale nepíšou si a nesdílí obsah.
- **Cílová skupina:** 13 let a víc. Hra není určená dětem, takže na ni nedopadají přísnější pravidla pro dětské aplikace.
- **Zpravodajská aplikace:** ne.
- **Zabezpečení dat** (Data safety):
  - Shromažďuje aplikace nebo sdílí data uživatelů? **Ne.** Postavy a nastavení zůstávají jen v zařízení a nákupy zpracovává Google Play.
  - Společná hra posílá jen to, co hra potřebuje (jméno a vzhled hrdiny, dění ve hře), přímo mezi zařízeními hráčů a nic se neukládá. Tak to popisují i zásady ochrany soukromí.
- **Vládní, finanční a zdravotní funkce:** ne.

## 4. Stránka hry v obchodě

**Rozšíření obchodu → Hlavní záznam v obchodě:**

- název, krátký popis a úplný popis: zkopíruj z `store/README.md` (část Čeština),
- ikona aplikace: `public/icons/icon-512.png`,
- grafika: `store/feature.png`,
- snímky obrazovky telefonu: `store/screenshots/cs_1_fight.png` až `cs_8_season.png` (stačí 4–8),
- kategorie: **Hry → Hraní rolí**, štítky třeba Akční RPG, Pixelová grafika, Dungeon, Kooperace,
- kontaktní e-mail a web https://oviiicek.github.io/loppo/.

Přidej i anglický překlad záznamu (**Přidat překlady → angličtina**): texty z části English v `store/README.md`, grafika `store/feature_en.png` a snímky `store/screenshots/en_*.png`.

## 5. Vyzkoušení ve vlastním telefonu

Nejrychleji: pošli si `app-release.apk` do telefonu a otevři ho. Android se zeptá, jestli smí instalovat z tohoto zdroje. Potvrď to.

Přes Google Play: **Testování → Interní testování → Vytvořit novou verzi → nahrát `app-release.aab`**. Do testerů přidej svůj e-mail a otevři odkaz pro testery v telefonu. Interní test nečeká na kontrolu Googlu.

## 6. Uzavřený test (12 testerů po 14 dní)

1. **Testování → Uzavřené testování → Vytvořit stopu** (nebo použij výchozí stopu Alfa).
2. **Vytvořit novou verzi → nahrát `app-release.aab`**. Do poznámek k verzi napiš třeba „První verze Deepwick“.
3. **Testeři:** přidej e-maily aspoň 12 lidí (nebo skupinu Google). Pošli jim odkaz pro přihlášení k testu.
4. Ulož a pošli verzi ke kontrole. Kontrola u nové aplikace trvá obvykle pár dní.
5. Testeři musí zůstat přihlášení 14 dní v kuse. Pak se na hlavní stránce aplikace objeví **Požádat o přístup do produkce**. Google se zeptá, jak test probíhal.

## 7. Nákupy perel

Hra prodává perly a balíčky přes Google Play Billing. Dokud v Play Console nejsou produkty, ukazují tlačítka v obchodě hry „Brzy“ a nic se neprodává.

1. **Nastavení → Profil plateb:** vytvoř obchodnický účet (údaje pro výplaty a daně).
2. **Zpeněžení → Produkty → Produkty v aplikaci** (jednorázové). Vytvoř přesně tato ID:

   | ID produktu | Co hráč dostane | Cena (návrh) |
   |---|---|---|
   | `pearls_50` | 50 perel | 49 Kč |
   | `pearls_130` | 120 + 10 perel | 99 Kč |
   | `pearls_345` | 300 + 45 perel | 229 Kč |
   | `pearls_850` | 700 + 150 perel | 499 Kč |
   | `starter` | Balíček nováčka: 100 perel, Žhnoucí aura, 2 pírka fénixe | 49 Kč |
   | `month` | Měsíc perel: 30 perel hned a 5 denně po 30 dní | 99 Kč |

   Název a popis produktu může být stejný jako ve hře. Ceny pro ostatní země Google přepočítá sám. Každý produkt aktivuj.
3. **Nastavení → Testování licencí:** přidej svůj e-mail. Pak si nákupy v testovací verzi vyzkoušíš bez placení.

Hra si ceny bere přímo z Google Play, takže je hráč vidí ve své měně. Každý nákup se připíše hrdinovi, se kterým hraje, a jen jednou.

## 8. Vydání pro všechny

Až Google povolí produkci: **Produkce → Vytvořit novou verzi → nahrát `app-release.aab`** (nebo převzít verzi z uzavřeného testu) → **Zkontrolovat verzi → Zahájit zavádění**. První kontrola Googlu trvá od několika hodin po několik dní.

## Aktualizace

- Každá nová verze pro Google Play musí mít vyšší číslo verze. To se nastavuje v `package.json` (např. 1.0.1). Kód verze se z něj spočítá sám.
- Sestavení: `bash tools/android.sh` (potřebuje Android SDK a podpisový klíč v `android/keystore.properties`).
- Nebo pošli klíč (`deepwick-upload.jks` a `keystore.properties`) do nové relace s Claudem a nech novou verzi sestavit.
- Google Play podepisuje aplikaci pro hráče vlastním klíčem (Podepisování aplikací Google Play). Tvůj klíč je jen „nahrávací“. Kdyby se ztratil, jde v Play Console požádat o nový (**Integrita aplikace**), ale trvá to.
