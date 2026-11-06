// What is sold for real money: packs of pearls, the newcomer's pack and the month of pearls. Prices are set
// per currency (the shown one follows the player's language); a native app shows the store's own price
// instead. Whether anything can be bought depends on the payment provider the build has (see
// systems/store.ts): without one the offers are shown as coming soon.
import type { Reward } from './live';

export type Currency = 'CZK' | 'EUR' | 'USD' | 'PLN';

export interface Product {
  id: string;
  kind: 'pearls' | 'starter' | 'month';
  /** pearls in the pack and the bonus on top (the first purchase of a pack doubles the pearls) */
  pearls: number;
  bonus: number;
  /** what else the pack gives */
  extra?: Reward[];
  /** the price in each currency */
  price: Record<Currency, number>;
  /** can be bought once per hero */
  once?: boolean;
  /** a ribbon in the shop */
  tag?: string;
}

export const PRODUCTS: Product[] = [
  { id: 'pearls_50', kind: 'pearls', pearls: 50, bonus: 0, price: { CZK: 49, EUR: 1.99, USD: 1.99, PLN: 8.99 } },
  { id: 'pearls_130', kind: 'pearls', pearls: 120, bonus: 10, price: { CZK: 99, EUR: 3.99, USD: 3.99, PLN: 17.99 }, tag: 'Oblíbené' },
  { id: 'pearls_345', kind: 'pearls', pearls: 300, bonus: 45, price: { CZK: 229, EUR: 8.99, USD: 8.99, PLN: 39.99 } },
  { id: 'pearls_850', kind: 'pearls', pearls: 700, bonus: 150, price: { CZK: 499, EUR: 19.99, USD: 19.99, PLN: 89.99 }, tag: 'Nejvýhodnější' },
  { id: 'starter', kind: 'starter', pearls: 100, bonus: 0, extra: [{ k: 'aura', id: 'ember' }, { k: 'phoenix' }, { k: 'phoenix' }], price: { CZK: 49, EUR: 1.99, USD: 1.99, PLN: 8.99 }, once: true },
  { id: 'month', kind: 'month', pearls: 30, bonus: 0, price: { CZK: 99, EUR: 3.99, USD: 3.99, PLN: 17.99 } },
];
export const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p])) as Record<string, Product>;

/** the month of pearls: pearls every day for this many days after the purchase */
export const MONTH_DAYS = 30;
export const MONTH_DAILY = 5;
/** the newcomer's pack is offered this many days from the hero's first day */
export const STARTER_DAYS = 7;

/** the currency the player most likely pays in (by the game's language) */
export function currencyFor(lang: string): Currency {
  if (lang === 'cs') return 'CZK';
  if (lang === 'pl') return 'PLN';
  if (lang === 'en') return 'USD';
  return 'EUR';
}

/** a price for the screen ("49 Kč", "1,99 €", "$1.99", "8,99 zł") */
export function formatPrice(v: number, c: Currency): string {
  const two = (x: number, sep: string) => (Number.isInteger(x) ? String(x) : x.toFixed(2).replace('.', sep));
  switch (c) {
    case 'CZK':
      return `${two(v, ',')} Kč`;
    case 'EUR':
      return `${two(v, ',')} €`;
    case 'PLN':
      return `${two(v, ',')} zł`;
    case 'USD':
      return `$${two(v, '.')}`;
  }
}

/** what a pack is worth in pearls, its extras counted at the shop's prices (for an honest "worth" line) */
export function productWorth(p: Product): number {
  let w = p.pearls + p.bonus;
  for (const r of p.extra ?? []) w += r.k === 'aura' ? 35 : r.k === 'phoenix' ? 25 : r.k === 'pearls' ? r.n : 0;
  if (p.kind === 'month') w += MONTH_DAYS * MONTH_DAILY;
  return w;
}

/** what one pearl costs in the smallest pack (shown next to the pearl prices, as consumer rules ask) */
export function pearlRate(c: Currency): number {
  const p = PRODUCT_BY_ID.pearls_50;
  return p.price[c] / (p.pearls + p.bonus);
}
