import { useState } from 'react';
import { DAYS } from '../data/itinerary';
import { Sheet } from './Sheet';
import { store, useTripState } from '../state/store';
import type { Booking } from '../state/schema';

export function BookingSheet({ id, presetDate, onClose }: { id?: string; presetDate?: string; onClose: () => void }) {
  const state = useTripState();
  const existing = state.bookings.find(b => b.id === id);
  const [draft, setDraft] = useState<Partial<Booking>>(existing ?? { id: crypto.randomUUID(), type: 'stay', name: '', date: presetDate ?? DAYS[0]?.d ?? '', addr: '' });
  return <Sheet open onClose={onClose} title={existing ? 'Edit booking' : 'Add booking'}><label className="f"><span>Type</span><select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as Booking['type'] })}><option value="stay">Stay</option><option value="car">Car</option><option value="fly">Flight</option><option value="act">Activity</option><option value="eat">Food</option></select></label><label className="f"><span>Name</span><input value={draft.name ?? ''} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><label className="f"><span>Date</span><select value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })}>{DAYS.map(d => <option key={d.d} value={d.d}>{d.d} — {d.t}</option>)}</select></label><label className="f"><span>Address</span><input value={draft.addr ?? ''} onChange={e => setDraft({ ...draft, addr: e.target.value })} /></label><label className="f"><span>Confirmation</span><input value={draft.conf ?? ''} onChange={e => setDraft({ ...draft, conf: e.target.value })} /></label><div className="row"><button className="btn" disabled={!draft.name} onClick={() => { const value = draft as Booking; store.mutate('bookings', value.id!, s => { const index = s.bookings.findIndex(b => b.id === value.id); if (index >= 0) s.bookings[index] = value; else s.bookings.push(value); }); onClose(); }}>Save booking</button><button className="btn ghost" onClick={onClose}>Cancel</button></div></Sheet>;
}
