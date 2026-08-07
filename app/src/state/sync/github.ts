import type { SyncConfig } from '../persist';

export class ConflictError extends Error {
  constructor() { super('Both phones are syncing at once'); }
}

export function encodeUtf8(s: string): string {
  const b = new TextEncoder().encode(s);
  let out = ''; b.forEach(c => { out += String.fromCharCode(c); });
  return btoa(out);
}
export function decodeUtf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(a);
}

export interface ContentsResponse { content?: string; sha?: string; encoding?: string }

export class GitHubRepo {
  constructor(private cfg: SyncConfig) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }
  private url(path: string) {
    return `https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}/contents/${path}`;
  }

  async getFile(path: string): Promise<ContentsResponse | null> {
    const ref = encodeURIComponent(this.cfg.branch || 'main');
    const r = await fetch(`${this.url(path)}?ref=${ref}`, { headers: this.headers() });
    if (r.status === 404) return null;
    if (r.status === 401) throw new Error('Token rejected — check it has not expired.');
    if (r.status === 403) throw new Error('Access denied — the token needs Contents: Read and write.');
    if (!r.ok) throw new Error(`GitHub returned ${r.status}`);
    return r.json();
  }

  /** The Contents API returns no body for blobs over 1 MB. This does. */
  async getBlob(sha: string): Promise<string | null> {
    const r = await fetch(
      `https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}/git/blobs/${sha}`,
      { headers: this.headers() });
    if (!r.ok) return null;
    return (await r.json()).content ?? null;
  }

  async putFile(path: string, b64: string, sha: string | null, msg: string) {
    const body: Record<string, unknown> = {
      message: msg, content: b64, branch: this.cfg.branch || 'main',
    };
    if (sha) body.sha = sha;
    const r = await fetch(this.url(path), {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.status === 409 || r.status === 422) throw new ConflictError();
    if (!r.ok) {
      let d = ''; try { d = (await r.json()).message || ''; } catch { /* body not JSON */ }
      throw new Error(`Write failed (${r.status}) ${d}`);
    }
    return r.json();
  }

  async testAccess(): Promise<true> {
    const ref = encodeURIComponent(this.cfg.branch || 'main');
    const r = await fetch(`${this.url('')}?ref=${ref}`, { headers: this.headers() });
    if (r.status === 404) throw new Error('Repository not found — check the owner and name.');
    if (r.status === 401) throw new Error('Token rejected — check it has not expired.');
    if (r.status === 403) throw new Error('Access denied — needs Contents: Read and write.');
    if (!r.ok) throw new Error(`GitHub returned ${r.status}`);
    return true;
  }
}
