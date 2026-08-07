import { expect, test } from 'vitest';
import { cheapestCard, headroom, spendForCard, totalSpendInIdr } from './budget';
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
