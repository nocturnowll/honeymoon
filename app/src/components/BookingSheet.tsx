import { useState } from 'react';
import { DAYS } from '../data/itinerary';
import { Sheet } from './Sheet';
import { store, useTripState } from '../state/store';
import { nightsCovered } from '../lib/bookings';
import type { Booking } from '../state/schema';

/** Live "N nights" readout under the date pickers. `end` may legitimately be
 *  unset (single night, the pre-range model), or entered backwards/equal to
 *  `date` — nightsCovered degrades that to one night rather than throwing,
 *  but the sheet still tells the user their range didn't make sense instead
 *  of silently reinterpreting it. */
function rangeHint(date?: string, end?: string): string {
  if (!date) return 'Pick a start date';
  if (!end) return '1 night';
  if (end <= date) return 'End must be after the start date — showing 1 night';
  const n = nightsCovered({ date, end }).length;
  return `${n} night${n === 1 ? '' : 's'} · checkout ${end}`;
}

export function BookingSheet({ id, presetDate, onClose }: { id?: string; presetDate?: string; onClose: () => void }) {
  const state = useTripState();
  const existing = state.bookings.find(b => b.id === id);
  const [draft, setDraft] = useState<Partial<Booking>>(existing ?? { id: crypto.randomUUID(), type: 'stay', name: '', date: presetDate ?? DAYS[0]?.d ?? '', addr: '' });
  return <Sheet open onClose={onClose} title={existing ? 'Edit booking' : 'Add booking'}>
    <label className="f"><span>Type</span><select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as Booking['type'] })}><option value="stay">Stay</option><option value="car">Car</option><option value="fly">Flight</option><option value="act">Activity</option><option value="eat">Food</option></select></label>
    <label className="f"><span>Name</span><input value={draft.name ?? ''} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
    <div className="grid2">
      <label className="f"><span>From</span><input type="date" value={draft.date ?? ''} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
      <label className="f"><span>To</span><input type="date" value={draft.end ?? ''} onChange={e => setDraft({ ...draft, end: e.target.value || undefined })} /></label>
    </div>
    <p className="hint">{rangeHint(draft.date, draft.end)}</p>
    <label className="f"><span>Address</span><input value={draft.addr ?? ''} onChange={e => setDraft({ ...draft, addr: e.target.value })} /></label>
    <label className="f"><span>Confirmation</span><input value={draft.conf ?? ''} onChange={e => setDraft({ ...draft, conf: e.target.value })} /></label>
    <details className="acc" open={!!(draft.checkin || draft.checkout)}>
      <summary>Times (optional)</summary>
      <div className="ab grid2">
        <label className="f"><span>Check-in</span><input type="time" value={draft.checkin ?? ''} onChange={e => setDraft({ ...draft, checkin: e.target.value || undefined })} /></label>
        <label className="f"><span>Check-out</span><input type="time" value={draft.checkout ?? ''} onChange={e => setDraft({ ...draft, checkout: e.target.value || undefined })} /></label>
      </div>
    </details>
    <div className="row"><button className="btn" disabled={!draft.name || !draft.date} onClick={() => { const value = draft as Booking; store.mutate('bookings', value.id!, s => { const index = s.bookings.findIndex(b => b.id === value.id); if (index >= 0) s.bookings[index] = value; else s.bookings.push(value); }); onClose(); }}>Save booking</button><button className="btn ghost" onClick={onClose}>Cancel</button></div>
  </Sheet>;
}
