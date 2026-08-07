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
