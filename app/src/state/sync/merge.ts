import { SYNCED, BY_ID, type TripState } from '../schema';

type Bag = Record<string, unknown>;

/** Per-field last-write-wins. Every field carries its own timestamp in `_t`,
 *  so two devices editing different things both keep their work. Keys known
 *  only through a tombstone are included so deletions survive the round trip.
 *
 *  Transcribed from the legacy single-file app. Behaviour is deliberately
 *  identical; only types were added. */
export function merge(local: TripState, remote: TripState): TripState {
  const lt = local._t || {}, rt = remote._t || {};
  const out: Bag = { _t: {} as Record<string, number> };
  const outT = out._t as Record<string, number>;
  const stamp = (s: string, k: string, t: number) => { outT[`${s}:${k}`] = t; };

  for (const sec of SYNCED) {
    const isArr = (BY_ID as readonly string[]).includes(sec);
    // `||`, NOT `??`. The original falls back on ANY falsy section, so a
    // corrupt remote state.json holding `"bookings": 0` degrades to empty
    // instead of throwing mid-sync. `??` only catches null/undefined and
    // would abort the whole sync on a payload the original survives.
    const L = (local as unknown as Bag)[sec] || (isArr ? [] : {});
    const R = (remote as unknown as Bag)[sec] || (isArr ? [] : {});
    const lmap: Bag = isArr
      ? Object.fromEntries(((L || []) as { id: string }[]).map(o => [o.id, o]))
      : (L as Bag);
    const rmap: Bag = isArr
      ? Object.fromEntries(((R || []) as { id: string }[]).map(o => [o.id, o]))
      : (R as Bag);

    const keys = new Set([...Object.keys(lmap || {}), ...Object.keys(rmap || {})]);
    const pre = sec + ':';
    for (const tm of [lt, rt])
      for (const p of Object.keys(tm))
        if (p.indexOf(pre) === 0) keys.add(p.slice(pre.length));

    const merged: Bag = {};
    keys.forEach(k => {
      const p = `${sec}:${k}`, a = lt[p] || 0, b = rt[p] || 0;
      const hasL = Object.prototype.hasOwnProperty.call(lmap, k);
      const hasR = Object.prototype.hasOwnProperty.call(rmap, k);
      let win: unknown, wt: number;
      if (hasL && hasR) { win = a >= b ? lmap[k] : rmap[k]; wt = Math.max(a, b); }
      else if (hasL) {
        if (b > a && b > 0) { stamp(sec, k, b); return; }  // remote deleted it later
        win = lmap[k]; wt = a;
      } else if (hasR) {
        if (a > b && a > 0) { stamp(sec, k, a); return; }  // local deleted it later
        win = rmap[k]; wt = b;
      } else { stamp(sec, k, Math.max(a, b)); return; }    // gone both sides, keep tombstone
      if (win === undefined || win === null) { stamp(sec, k, Math.max(a, b)); return; }
      merged[k] = win; stamp(sec, k, wt || Date.now());
    });

    out[sec] = isArr ? Object.values(merged) : merged;
  }

  const bookings = out.bookings as { date: string }[] | undefined;
  if (bookings) bookings.sort((x, y) => (x.date < y.date ? -1 : 1));
  return out as unknown as TripState;
}

/** Stamp a change so the merge knows what is newest. Must be called on every
 *  mutation, or that edit will silently lose to the other device. */
export function touch(s: TripState, section: string, key: string | number): void {
  s._t = s._t || {};
  s._t[`${section}:${key}`] = Date.now();
}
