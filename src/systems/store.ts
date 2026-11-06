// Buying for real money. The way depends on the build and the device:
// - 'native': the app from Google Play or the App Store (Capacitor with the cordova-plugin-purchase plugin, which
//   puts CdvPurchase on window). The store's own payment sheet and prices are used.
// - 'web': the page pays through the game's small server (server/store-worker.js: Stripe Checkout). After paying,
//   the player comes back with ?paid=<session>; the server hands back a grant signed with its private key, the
//   game checks the signature with the public key from package.json ("store") and gives the pearls once.
// - 'test': the dev build (or ?store=test on it) pretends to pay, so the whole way can be tried.
// Without any of them the offers are shown as coming soon. Whatever is bought goes to the hero being played
// (pearls belong to a hero), and every purchase is given once (its id is kept in the hero's save).
import type { SaveData } from './state';
import { addPearls, saveGame } from './state';
import { PRODUCT_BY_ID, Product, currencyFor, formatPrice, MONTH_DAYS, MONTH_DAILY } from '../data/store';
import { pearlState, dayKey } from '../data/pearls';
import { grantLook } from '../data/live';
import { currentLang } from '../i18n/i18n';

export type StoreKind = 'native' | 'web' | 'test' | 'none';

/** what a purchase gave (for the thank-you message) */
export interface Granted {
  product: Product;
  pearls: number;
  firstBonus: boolean;
}

type GrantListener = (g: Granted) => void;
const listeners: GrantListener[] = [];
/** the game wants to hear about every purchase given (it shows the thanks and refreshes the panels) */
export function onGranted(fn: GrantListener) {
  listeners.push(fn);
}

/** the hero the purchases go to (set while a game runs) */
let heroOf: () => SaveData | null = () => null;
export function setStoreHero(fn: () => SaveData | null) {
  heroOf = fn;
}

const PENDING_KEY = 'loppo-grants';

function devBuild() {
  return import.meta.env.DEV || import.meta.env.MODE === 'devtools';
}

let kind: StoreKind = 'none';
/** the localized prices from the native store */
const nativePrices: Record<string, string> = {};

export function storeKind(): StoreKind {
  return kind;
}

/** can anything be bought right now */
export const storeOpen = () => kind !== 'none';

/** the price of a product as the player will pay it */
export function priceOf(p: Product): string {
  if (kind === 'native' && nativePrices[p.id]) return nativePrices[p.id];
  const c = currencyFor(currentLang());
  return formatPrice(p.price[c], c);
}

/** the products this hero can buy now (the newcomer's pack once and only in its first week; a running month of
 *  pearls is not bought again) */
export function canBuy(s: SaveData, p: Product): boolean {
  const st = pearlState(s);
  if (p.once && (st.buys?.[p.id] ?? 0) > 0) return false;
  if (p.kind === 'month' && st.month && st.month.until >= dayKey(new Date())) return false;
  return true;
}

/** the first purchase of a pack of pearls doubles its pearls */
export function firstPurchase(s: SaveData) {
  const b = pearlState(s).buys ?? {};
  return !Object.keys(b).some((id) => PRODUCT_BY_ID[id]?.kind === 'pearls');
}

/** gives a purchase to a hero (once per purchase id) */
export function grantProduct(s: SaveData, productId: string, purchaseId: string): Granted | null {
  const p = PRODUCT_BY_ID[productId];
  if (!p) return null;
  const st = pearlState(s);
  const done = (st.grants ??= []);
  if (done.includes(purchaseId)) return null;
  done.push(purchaseId);
  if (done.length > 200) done.splice(0, done.length - 200);
  const first = p.kind === 'pearls' && firstPurchase(s);
  const pearls = p.pearls + p.bonus + (first ? p.pearls : 0);
  addPearls(s, pearls);
  for (const r of p.extra ?? []) {
    if (r.k === 'aura' || r.k === 'trail' || r.k === 'title') grantLook(st, r.k, r.id);
    else if (r.k === 'phoenix') st.phoenix = (st.phoenix ?? 0) + 1;
    else if (r.k === 'pearls') addPearls(s, r.n);
  }
  if (p.kind === 'month') {
    const end = new Date();
    end.setDate(end.getDate() + MONTH_DAYS - 1);
    st.month = { until: dayKey(end), last: dayKey(new Date()) };
  }
  // a thank-you that shows: the title "Zlaté srdce" for everyone who supported the game
  grantLook(st, 'title', 'heart');
  (st.buys ??= {})[p.id] = (st.buys[p.id] ?? 0) + 1;
  if (!s.fallen) saveGame(s);
  const g = { product: p, pearls, firstBonus: first };
  for (const fn of listeners) fn(g);
  return g;
}

/** a grant for the hero being played, or kept until a game runs (a purchase made on the web comes back before) */
function deliver(productId: string, purchaseId: string) {
  const s = heroOf();
  if (s) return grantProduct(s, productId, purchaseId);
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]') as [string, string][];
    if (!list.some((x) => x[1] === purchaseId)) list.push([productId, purchaseId]);
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    /* no storage: the server keeps the session claimed, so this would be lost – rare enough */
  }
  return null;
}

/** purchases that waited for a game: given to the hero now being played */
export function deliverPending() {
  const s = heroOf();
  if (!s) return;
  let list: [string, string][] = [];
  try {
    list = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]');
    localStorage.removeItem(PENDING_KEY);
  } catch {
    return;
  }
  for (const [p, id] of list) grantProduct(s, p, id);
}

// ---------------------------------------------------------------- web (Stripe Checkout through the game's server)
function fromB64u(t: string) {
  const s = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** the grant's signature is the server's (the text signed is "product|nonce|ts") */
async function verifyGrant(g: { product: string; nonce: string; ts: number }, sig: string) {
  const pub = __STORE__.publicKey;
  if (!pub || !crypto?.subtle) return false;
  try {
    const key = await crypto.subtle.importKey('jwk', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromB64u(sig), new TextEncoder().encode(`${g.product}|${g.nonce}|${g.ts}`));
  } catch {
    return false;
  }
}

async function post(path: string, body: unknown) {
  const r = await fetch(__STORE__.api.replace(/\/$/, '') + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

/** back from the payment page (?paid=<session>): the grant is claimed, checked and given */
async function claimReturn() {
  const q = new URLSearchParams(location.search);
  const session = q.get('paid');
  if (!session) return;
  // the address is cleaned at once (a reload must not claim again)
  q.delete('paid');
  history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : '') + location.hash);
  try {
    const res = (await post('/claim', { session })) as { grant: { product: string; nonce: string; ts: number }; sig: string };
    if (res?.grant && (await verifyGrant(res.grant, res.sig))) deliver(res.grant.product, 'web:' + res.grant.nonce);
  } catch {
    /* not paid, claimed already or the server is away: nothing is given */
  }
}

// ---------------------------------------------------------------- native (cordova-plugin-purchase in the Capacitor app)
interface CdvWhen {
  approved(fn: (t: { verify(): void }) => void): CdvWhen;
  verified(fn: (r: { finish(): void }) => void): CdvWhen;
  finished(fn: (t: { transactionId: string; products: { id: string }[] }) => void): CdvWhen;
}
interface CdvStore {
  register(p: { id: string; type: string; platform: string }[]): void;
  when(): CdvWhen;
  initialize(platforms: string[]): Promise<unknown>;
  get(id: string): { pricing?: { price: string }; getOffer(): { order(): Promise<unknown> } | undefined } | undefined;
}

function nativeStore(): { store: CdvStore; ProductType: Record<string, string>; Platform: Record<string, string> } | null {
  const c = (window as unknown as { CdvPurchase?: { store: CdvStore; ProductType: Record<string, string>; Platform: Record<string, string> } }).CdvPurchase;
  return c?.store ? c : null;
}

async function initNative() {
  const c = nativeStore();
  if (!c) return false;
  const cap = (window as unknown as { Capacitor?: { getPlatform(): string } }).Capacitor;
  const platform = cap?.getPlatform() === 'ios' ? c.Platform.APPLE_APPSTORE : c.Platform.GOOGLE_PLAY;
  c.store.register(Object.keys(PRODUCT_BY_ID).map((id) => ({ id, type: c.ProductType.CONSUMABLE, platform })));
  c.store
    .when()
    .approved((t) => t.verify())
    .verified((r) => r.finish())
    .finished((t) => {
      for (const p of t.products) deliver(p.id, 'native:' + t.transactionId);
    });
  await c.store.initialize([platform]);
  for (const id of Object.keys(PRODUCT_BY_ID)) {
    const pr = c.store.get(id)?.pricing?.price;
    if (pr) nativePrices[id] = pr;
  }
  return true;
}

// ---------------------------------------------------------------- the way chosen at the start
export async function initStore() {
  if (devBuild() && (/[?&]store=test/.test(location.search) || import.meta.env.MODE === 'devtools')) kind = 'test';
  else if (await initNative().catch(() => false)) kind = 'native';
  else if (__STORE__.api && __STORE__.publicKey) kind = 'web';
  if (kind === 'web') await claimReturn();
}

/** buys a product: the payment sheet, the payment page (the game is left and comes back) or the pretend payment
 *  of the test build; resolves with an error text when it could not even start */
export async function buyProduct(p: Product): Promise<string | null> {
  const s = heroOf();
  if (!s) return 'Nákup jde jen během hry';
  if (!canBuy(s, p)) return 'Tohle už máš';
  try {
    if (kind === 'test') {
      await new Promise((r) => setTimeout(r, 500));
      deliver(p.id, 'test:' + Date.now() + ':' + Math.random().toString(36).slice(2, 8));
      return null;
    }
    if (kind === 'native') {
      const offer = nativeStore()?.store.get(p.id)?.getOffer();
      if (!offer) return 'Obchod teď nákup nenabízí';
      await offer.order();
      return null;
    }
    if (kind === 'web') {
      saveGame(s);
      const res = (await post('/checkout', { product: p.id, lang: currentLang() })) as { url?: string };
      if (!res?.url) return 'Platbu se nepodařilo založit';
      location.assign(res.url);
      return null;
    }
  } catch {
    return 'Platbu se nepodařilo založit – zkus to prosím za chvíli znovu';
  }
  return 'Nákupy zatím nejsou dostupné';
}

/** the month of pearls: today's pearls, once a day while it lasts (0 when there is nothing to take) */
export function monthPearlsToday(s: SaveData): number {
  const st = pearlState(s);
  const m = st.month;
  const today = dayKey(new Date());
  if (!m || m.until < today || m.last === today) return 0;
  return MONTH_DAILY;
}

export function takeMonthPearls(s: SaveData): number {
  const n = monthPearlsToday(s);
  if (!n) return 0;
  pearlState(s).month!.last = dayKey(new Date());
  addPearls(s, n);
  return n;
}
