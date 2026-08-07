import { test, expect } from '@playwright/test';

test('booting the SPA does not clobber existing legacy state, and edits survive a reload', async ({ page }) => {
  // addInitScript re-runs on every navigation, including page.reload() below —
  // guard the seed so the reload doesn't stomp the edit made mid-test back to
  // the original value.
  await page.addInitScript(() => {
    if (!localStorage.getItem('larchcanyon')) {
      localStorage.setItem('larchcanyon', JSON.stringify({
        notes: { '8': 'Sample note one' },
        _t: { 'notes:8': 1785862471786 },
      }));
    }
  });
  await page.goto('./');
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('larchcanyon')!).notes['8']);
  expect(before).toBe('Sample note one');

  await page.evaluate(() => localStorage.setItem('larchcanyon',
    JSON.stringify({ ...JSON.parse(localStorage.getItem('larchcanyon')!),
      notes: { '8': 'edited' } })));
  await page.reload();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('larchcanyon')!).notes['8']);
  expect(after).toBe('edited');
});

test('no request ever leaves for Google Fonts', async ({ page }) => {
  const external: string[] = [];
  page.on('request', r => { if (r.url().includes('fonts.g')) external.push(r.url()); });
  await page.goto('./');
  await page.waitForLoadState('networkidle');
  expect(external).toEqual([]);
});

test('IndexedDB helpers put/get/keys/del a blob through the app\'s own code', async ({ page }) => {
  await page.goto('./idb-harness.html');

  const putOk = await page.evaluate(() =>
    window.__idbTest.put('e2e-test-key', 'hello from playwright', 'text/plain'));
  expect(putOk).toBe(true);

  const keysAfterPut = await page.evaluate(() => window.__idbTest.keys());
  expect(keysAfterPut).toContain('e2e-test-key');

  const readBack = await page.evaluate(() => window.__idbTest.get('e2e-test-key'));
  expect(readBack).toEqual({ data: 'hello from playwright', type: 'text/plain' });

  const delOk = await page.evaluate(() => window.__idbTest.del('e2e-test-key'));
  expect(delOk).toBe(true);

  const keysAfterDel = await page.evaluate(() => window.__idbTest.keys());
  expect(keysAfterDel).not.toContain('e2e-test-key');

  const readAfterDel = await page.evaluate(() => window.__idbTest.get('e2e-test-key'));
  expect(readAfterDel).toBeNull();
});
