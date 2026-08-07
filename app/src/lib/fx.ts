import type { Card } from '../state/schema';

export const FALLBACK = { IDR: 16500, CAD: 1.37, USD: 1 } as const;

export const FX = {
  rates: { ...FALLBACK } as Record<string, number>,
  at: null as string | null,
  stale: false,
  load() {
    try {
      const c = JSON.parse(localStorage.getItem('larchcanyon.fx') || 'null') as { rates?: Record<string, number>; at?: string } | null;
      if (c?.rates) { this.rates = c.rates; this.at = c.at ?? null; }
    } catch { /* use fallback */ }
    if (!this.rates) { this.rates = { ...FALLBACK }; this.at = null; }
  },
  async refresh(force = false): Promise<Record<string, number>> {
    const age = this.at ? (Date.now() - new Date(this.at).getTime()) / 36e5 : 1e9;
    if (!force && age < 6) return this.rates;
    if (!navigator.onLine) { this.stale = true; return this.rates; }
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!r.ok) throw new Error('rate request failed');
      const j = await r.json() as { rates?: Record<string, number>; time_last_update_utc?: string };
      if (!j.rates?.IDR) throw new Error('rate response incomplete');
      this.rates = { IDR: j.rates.IDR, CAD: j.rates.CAD ?? FALLBACK.CAD, USD: 1 };
      this.at = j.time_last_update_utc || new Date().toISOString();
      this.stale = false;
      localStorage.setItem('larchcanyon.fx', JSON.stringify({ rates: this.rates, at: this.at }));
    } catch { this.stale = true; }
    return this.rates;
  },
  idr(cur: string): number {
    const r = this.rates || FALLBACK;
    if (cur === 'IDR') return 1;
    if (cur === 'USD') return r.IDR;
    if (!r[cur]) return r.IDR;
    return r.IDR / r[cur];
  },
  age(): string {
    if (!this.at) return 'no live rate yet';
    const d = new Date(this.at);
    const hrs = Math.round((Date.now() - d.getTime()) / 36e5);
    if (hrs < 1) return 'updated just now';
    if (hrs < 48) return `updated ${hrs}h ago`;
    return `as of ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  },
};

export function cardRate(card: Partial<Card> | null | undefined, cur: string): number {
  const mid = FX.idr(cur || 'USD');
  const markup = card?.markup != null ? card.markup : 0;
  const fee = card?.fee != null ? card.fee : 0;
  return mid * (1 + (markup + fee) / 100);
}

FX.load();
