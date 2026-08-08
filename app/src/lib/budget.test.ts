import { expect, test } from 'vitest';
import { cheapestCard, headroom, showsCheapest, spendForCard, totalSpendInIdr, warnsNearLimit } from './budget';
import { FX } from './fx';

const cards = [{ id:'a', type:'visa', nick:'A', cur:'IDR', limit:1000, markup:2 }, { id:'b', type:'mastercard', nick:'B', cur:'IDR', limit:2000, markup:4 }];
const spend = [{ id:'s1', what:'Dinner', amt:100, cur:'IDR', card:'a', date:'2026-09-20' }, { id:'s2', what:'Fuel', amt:200, cur:'IDR', card:'a', date:'2026-09-21' }, { id:'s3', what:'Hotel', amt:300, cur:'IDR', card:'b', date:'2026-09-22' }];

test('totals spend per card in its native currency', () => {
  expect(spendForCard(spend, cards[0])).toBe(300);
  expect(spendForCard(spend, cards[1])).toBe(300);
});

test('headroom reports spent and warning percentage', () => {
  expect(headroom(cards[0], spend)).toMatchObject({ spent: 306, remaining: 694 });
  expect(headroom(cards[0], spend).percent).toBeCloseTo(30.6, 8);
});

test('spend converts into the card currency', () => {
  FX.rates = { IDR: 16500, CAD: 1.37, USD: 1 };
  expect(spendForCard([{ id:'s4', amt: 10, cur:'USD', card:'a', date:'2026-09-20' }], cards[0])).toBe(165000);
});

test('total spend includes the selected card markup', () => {
  FX.rates = { IDR: 16500, CAD: 1.37, USD: 1 };
  expect(totalSpendInIdr([{ id:'s5', amt: 10, cur:'USD', card:'a', date:'2026-09-20' }], cards)).toBe(165000 * 1.02);
});

test('cheapest-card selection uses effective card rate', () => {
  FX.rates = { IDR: 16500, CAD: 1.37, USD: 1 };
  expect(cheapestCard(cards)?.id).toBe('a');
});

test('cheapest banner does not show with only one card to compare against cash', () => {
  const oneCardOneCash = [
    { id: 'a', type: 'visa', nick: 'A', cur: 'IDR', limit: 1000, markup: 2 },
    { id: 'cash', type: 'cash', nick: 'Cash', cur: 'USD', limit: 500 },
  ];
  expect(showsCheapest(oneCardOneCash)).toBe(false);
});

test('cheapest banner shows and names the lower-rate card when there are two cards', () => {
  expect(showsCheapest(cards)).toBe(true);
  expect(cheapestCard(cards)?.nick).toBe('A');
});

test('cash warns once more than 85% of the amount carried is logged', () => {
  expect(warnsNearLimit({ id: 'cash', type: 'cash', nick: 'Cash', cur: 'USD', limit: 500 }, 90)).toBe(true);
});

test('cash does not warn at 50% logged', () => {
  expect(warnsNearLimit({ id: 'cash', type: 'cash', nick: 'Cash', cur: 'USD', limit: 500 }, 50)).toBe(false);
});

test('the 85% threshold is strict, matching the card copy ("more than 85%")', () => {
  expect(warnsNearLimit(cards[0], 85)).toBe(false);
  expect(warnsNearLimit(cards[0], 85.01)).toBe(true);
});
