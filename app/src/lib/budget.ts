import type { Card, Spend } from '../state/schema';
import { cardRate, FX } from './fx';

export function spendForCard(spend: Spend[], card: Card): number {
  const currency = card.cur || 'IDR';
  return spend.filter(entry => entry.card === card.id).reduce((total, entry) => total + (entry.cur === currency ? entry.amt : entry.amt * FX.idr(entry.cur || 'USD') / FX.idr(currency)), 0);
}

export function spendEntryInIdr(entry: Spend, card: Card | null): number {
  return entry.amt * (card ? cardRate(card, entry.cur || 'USD') : FX.idr(entry.cur || 'USD'));
}

export function totalSpendInIdr(spend: Spend[], cards: Card[]): number {
  return spend.reduce((total, entry) => total + spendEntryInIdr(entry, cards.find(card => card.id === entry.card) ?? null), 0);
}

export function spendInIdr(spend: Spend[], card: Card | null): number {
  return spend.reduce((total, entry) => total + spendEntryInIdr(entry, card), 0);
}

export function headroom(card: Card, spend: Spend[]): { spent: number; remaining: number; percent: number } {
  const spent = card.type === 'cash'
    ? spendForCard(spend, card)
    : spend.filter(entry => entry.card === card.id).reduce((total, entry) => total + spendEntryInIdr(entry, card), 0);
  const limit = card.limit ?? 0;
  return { spent, remaining: limit - spent, percent: limit ? spent / limit * 100 : 0 };
}

export function cheapestCard(cards: Card[], currency = 'USD'): Card | null {
  return cards.filter(card => card.type !== 'cash').reduce<Card | null>((best, card) => !best || cardRate(card, currency) < cardRate(best, currency) ? card : best, null);
}

// A "cheapest card" comparison is only meaningful between cards you can actually
// choose to spend on — cash isn't a payment option to compare rates against.
export function showsCheapest(cards: Card[]): boolean {
  return cards.filter(card => card.type !== 'cash').length > 1;
}

// Matches the live app's copy ("More than 85% ... is logged"): the warning
// must not fire until spend is strictly past 85%, for cash and cards alike.
export function warnsNearLimit(card: Card, percent: number): boolean {
  return percent > 85;
}
