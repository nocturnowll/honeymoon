import { afterEach, expect, test, vi } from 'vitest';
import { dObj, daysBetween, mins, tripPhase } from './dates';

afterEach(() => vi.useRealTimers());

test('a date string parses as local, not UTC', () => {
  expect(dObj('2026-09-14').getDate()).toBe(14);
});

test('daysBetween spans the trip correctly', () => {
  expect(daysBetween('2026-09-14', '2026-10-06')).toBe(22);
});

test('tripPhase reports before, during, and after around the real trip dates', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 13));
  expect(tripPhase()).toEqual({ p: 'before', n: 1 });
  vi.setSystemTime(new Date(2026, 8, 14));
  expect(tripPhase()).toEqual({ p: 'during', n: 1 });
  vi.setSystemTime(new Date(2026, 9, 6));
  expect(tripPhase()).toEqual({ p: 'during', n: 23 });
  vi.setSystemTime(new Date(2026, 9, 7));
  expect(tripPhase()).toEqual({ p: 'after', n: 1 });
});

test('mins parses a schedule time to minutes past midnight', () => {
  expect(mins('14:30')).toBe(870);
});
