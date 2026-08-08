import { useMemo } from 'react';
import { DAYS, LOC } from '../data/itinerary';
import { dLabel } from '../lib/dates';
import { unbookedNights } from '../lib/bookings';
import { store, useTripState, usePhotoRevision } from '../state/store';
import { SavedAttachment } from './BookingSheet';

export function BookingList({ onEdit }: { onEdit: (id?: string, date?: string) => void }) {
  const state = useTripState();
  usePhotoRevision();
  // Keyed on `state`, not `state.bookings`: `BookingSheet`'s save handler
  // mutates the bookings array in place (`push` / index assignment) rather
  // than replacing it, so the array reference is unchanged even though its
  // contents are. `state` itself always gets a fresh reference from
  // `store`'s `emit()`, so that is what has to drive the recompute — keying
  // on `state.bookings` left every new or edited booking invisible until a
  // reload (deletes, which `filter` into a new array, happened to work).
  const groups = useMemo(() => { const map = new Map<string, typeof state.bookings>(); state.bookings.forEach(b => map.set(b.date, [...(map.get(b.date) ?? []), b])); return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)); }, [state]);
  const unbooked = unbookedNights(DAYS.filter(d => d.stay !== 'In the air'), state.bookings);
  return <div>{unbooked.length > 0 && <div className="alert"><b>{unbooked.length} nights still need a stay</b></div>}{groups.map(([date, bookings]) => <section key={date} className="booking-group"><div className="sect-h"><h2>{dLabel(date)}</h2></div>{bookings.map(booking => <article className="card pad booking-card" key={booking.id}><div className="row"><span className="tag">{booking.type}</span><strong>{booking.name}</strong><span className="sp" /><button className="btn ghost sm" onClick={() => onEdit(booking.id)}>Edit</button></div>{booking.addr && <p className="hint">{booking.addr}</p>}{booking.conf && <p className="mono">Confirmation {booking.conf}</p>}{booking.addr && <a href={`https://maps.google.com/?q=${encodeURIComponent(booking.addr)}`} target="_blank" rel="noreferrer">Open in Maps</a>}{booking.files && booking.files.length > 0 && <div className="attach-list">{booking.files.map(file => <SavedAttachment key={file.p} file={file} />)}</div>}</article>)}</section>)}<section className="sect-h"><h2>Receipts &amp; tickets</h2></section>{state.docs.length ? state.docs.map(doc => <div className="card pad" key={doc.id}>{doc.label}</div>) : <div className="empty card"><p>No receipts or tickets yet.</p></div>}<button className="btn" onClick={() => onEdit(undefined, DAYS[0]?.d)}>Add booking</button></div>;
}
