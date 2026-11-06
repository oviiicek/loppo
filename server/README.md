# Platby ve hře Deepwick

Hra prodává perly a balíčky za skutečné peníze. Produkty a ceny jsou v `src/data/store.ts`, nákupní logika je v
`src/systems/store.ts`. Dokud není nastavená žádná cesta k placení, hra nabídky jen ukazuje s tlačítkem „Brzy“.

Každý nákup se připíše postavě, se kterou hráč právě hraje, a to jen jednou: identifikátor nákupu se uloží do
uložené hry. Kdo koupí cokoli, dostane titul „Zlaté srdce“. První nákup balíčku perel dá dvakrát tolik perel.

## 1. Webová verze (GitHub Pages): Stripe + Cloudflare Worker

Jak to probíhá:

1. Hra pošle `POST /checkout` na malý server (`server/store-worker.js`) a server založí platební stránku Stripe.
2. Hráč zaplatí a Stripe ho vrátí do hry s adresou `?paid=<session>`.
3. Hra pošle `POST /claim`. Server u Stripe ověří, že je zaplaceno, a vydá potvrzení podepsané soukromým klíčem.
   Každou platbu jde vyzvednout jen jednou.
4. Hra ověří podpis veřejným klíčem z `package.json` a perly připíše.

Nastavení:

1. Založ si účet na [stripe.com](https://stripe.com):
   - Doplň údaje o firmě nebo živnosti.
   - V Products vytvoř produkty s cenami: `pearls_50`, `pearls_130`, `pearls_345`, `pearls_850`, `starter`, `month`.
     Ceny ber podle `src/data/store.ts`, třeba 49 Kč, 99 Kč, 229 Kč a 499 Kč.
   - Zkopíruj si ID cen (`price_…`).
   - V Settings → Public details nastav odkaz na obchodní podmínky. Server chce jejich odsouhlasení u každé platby.
2. Založ si účet na [cloudflare.com](https://cloudflare.com) a nainstaluj Wrangler: `npm i -g wrangler`, pak
   `wrangler login`.
3. Vygeneruj klíče: `node server/keys.mjs`.
   - Řádek `GRANT_KEY` patří jen na server. Nikdy ho nedávej do repozitáře.
   - Řádek `publicKey` vlož do `package.json` jako `"store": { "api": "…", "publicKey": { … } }`.
4. Ve složce `server/`:
   - `wrangler kv namespace create CLAIMS` a vrácené `id` vlož do `wrangler.toml`.
   - Do `wrangler.toml` vyplň `PRICE_…` z kroku 1.
   - `wrangler secret put STRIPE_KEY` (tajný klíč `sk_live_…`, na zkoušku `sk_test_…`).
   - `wrangler secret put GRANT_KEY` (soukromý klíč z kroku 3).
   - `wrangler deploy`. Vypíše adresu serveru, např. `https://deepwick-store.<účet>.workers.dev`.
5. Adresu serveru vlož do `package.json` jako `"store": { "api": "https://…workers.dev", … }`, sestav hru a nasaď ji
   (`bash tools/deploy.sh "…"`).

Na zkoušku stačí testovací klíč `sk_test_…` a testovací karta Stripe `4242 4242 4242 4242`.

## 2. Aplikace pro Android a iOS (Capacitor)

Google Play i App Store vyžadují pro digitální zboží vlastní platby obchodu. Hra je umí přes plugin
`cordova-plugin-purchase`, který přidá do aplikace `window.CdvPurchase`.

1. V projektu s Capacitorem: `npm i cordova-plugin-purchase` a pak `npx cap sync`.
2. V Google Play Console (a v App Store Connect) vytvoř produkty se stejnými ID: `pearls_50`, `pearls_130`,
   `pearls_345`, `pearls_850`, `starter`, `month`. Typ je „spotřebitelný“ (consumable).
3. Hra si ceny vezme přímo z obchodu, takže je hráč uvidí ve své měně.

Hra se sama pozná: když najde `CdvPurchase`, platí přes obchod. Na webu platí přes server z bodu 1, pokud je
nastavený. Ve vývojové verzi (`npm run dev`, `--mode devtools`) jen předstírá zaplacení, aby šlo všechno vyzkoušet.

## Právní minimum (EU)

- Ceny perel jsou ve hře vidět i v penězích (kolik stojí perla v nejmenším balíčku).
- Obchodní podmínky musí říct, že digitální obsah se dodává hned, a že kupující tím ztrácí právo odstoupit od
  smlouvy do 14 dnů. Stripe souhlas sbírá u každé platby, když je zapnutý.
- Hra nemá placené náhodné odměny (loot boxy). Všechno, co se kupuje, je předem jasně dané.
