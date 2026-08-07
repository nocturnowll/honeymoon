import { expect, test } from 'vitest';
import { collectRefs, PHOTO_DIR } from './photos';
import { emptyState } from '../schema';

test('refs are collected from photos, outfits, docs and booking files', () => {
  const s = emptyState();
  s.photos['1.0'] = { p: 'a' };
  s.outfits['yos'] = { img: { p: 'b' }, img2: { p: 'c' } };
  s.docs = [{ id: 'd1', label: 'Boarding pass', img: { p: 'd' } }];
  s.bookings = [{ id:'b1', type:'stay', name:'Zion', date:'2026-09-28',
    files: [{ p: 'e' }] }];
  expect(collectRefs(s).map(r => r.p).sort()).toEqual(['a','b','c','d','e']);
});

test('string photo values from the legacy format are not treated as refs', () => {
  const s = emptyState();
  s.photos['2.0'] = 'https://example.com/x.jpg';
  expect(collectRefs(s)).toHaveLength(0);
});

test('photos are written to the frozen remote directory', () => {
  expect(PHOTO_DIR).toBe('data/photos');
});
