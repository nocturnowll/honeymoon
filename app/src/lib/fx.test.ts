import { afterEach, expect, test } from 'vitest';
import { FX, cardRate } from './fx';

afterEach(() => {
  FX.rates = { IDR: 16500, CAD: 1.37, USD: 1 };
  FX.at = null;
  FX.stale = false;
});

test('idr converts a non-USD currency via the USD cross rate', () => {
  FX.rates = { IDR: 16500, CAD: 1.37, USD: 1 };
  expect(FX.idr('USD')).toBe(16500);
  expect(FX.idr('IDR')).toBe(1);
  expect(FX.idr('CAD')).toBeCloseTo(16500 / 1.37, 6);
});

test('an unknown currency falls back to the USD rate rather than NaN', () => {
  FX.rates = { IDR: 16500, CAD: 1.37, USD: 1 };
  expect(FX.idr('JPY')).toBe(16500);
});

test('cardRate adds the bank markup and any flat fee on top of mid-market', () => {
  FX.rates = { IDR: 16500, CAD: 1.37, USD: 1 };
  const c = { id:'c', type:'visa', nick:'x', markup: 2.5, fee: 0.5 };
  expect(cardRate(c, 'USD')).toBeCloseTo(16500 * 1.03, 6);
});

test('a card with no markup costs mid-market', () => {
  FX.rates = { IDR: 16500, CAD: 1.37, USD: 1 };
  expect(cardRate({ id:'c', type:'visa', nick:'x' }, 'USD')).toBe(16500);
});
