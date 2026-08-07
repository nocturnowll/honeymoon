import { expect, test, beforeEach } from 'vitest';
import { loadState, saveState, loadSyncConfig, saveSyncConfig } from './persist';
import { emptyState } from './schema';
import fixture from './__fixtures__/state.json';

beforeEach(() => localStorage.clear());

test('reads state written by the legacy app from the frozen key', () => {
  localStorage.setItem('larchcanyon', JSON.stringify(fixture));
  const s = loadState();
  expect(s.notes['8']).toBe('Sample note one');
  expect(Object.keys(s.photos)).toHaveLength(2);
});

test('missing sections are filled without clobbering present ones', () => {
  localStorage.setItem('larchcanyon', JSON.stringify({ notes: { 1: 'hi' } }));
  const s = loadState();
  expect(s.notes['1']).toBe('hi');
  expect(s.bookings).toEqual([]);
});

test('corrupt JSON yields an empty state rather than throwing', () => {
  localStorage.setItem('larchcanyon', '{not json');
  expect(loadState()).toEqual(emptyState());
});

test('saveState writes to the frozen key and reports success', () => {
  const s = emptyState(); s.notes['3'] = 'x';
  expect(saveState(s)).toBe(true);
  expect(JSON.parse(localStorage.getItem('larchcanyon')!).notes['3']).toBe('x');
});

test('sync config round-trips on its own key', () => {
  saveSyncConfig({ owner:'nocturnowll', repo:'honeymoon-data',
    branch:'main', token:'ghp_x', device:'Ken' });
  expect(loadSyncConfig()!.repo).toBe('honeymoon-data');
  expect(localStorage.getItem('larchcanyon.gh')).toContain('ghp_x');
});
