import { expect, test, vi } from 'vitest';
import { GitHubRepo, encodeUtf8, decodeUtf8, ConflictError } from './github';

const cfg = { owner:'o', repo:'r', branch:'main', token:'t', device:'d' };

test('base64 helpers survive non-ASCII', () => {
  const s = 'Sample note two — café ☕';
  expect(decodeUtf8(encodeUtf8(s))).toBe(s);
});

test('a missing file reads as null rather than throwing', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({ status: 404, ok: false }) as never;
  expect(await new GitHubRepo(cfg).getFile('data/state.json')).toBeNull();
});

test('an expired token produces an actionable message', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({ status: 401, ok: false }) as never;
  await expect(new GitHubRepo(cfg).getFile('x')).rejects.toThrow(/expired/i);
});

test('a 409 from a concurrent write is typed as a conflict', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({ status: 409, ok: false }) as never;
  await expect(new GitHubRepo(cfg).putFile('x', 'AA==', null, 'm'))
    .rejects.toBeInstanceOf(ConflictError);
});
