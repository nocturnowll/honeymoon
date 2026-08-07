import { useMemo } from 'react';
import { DAYS, LOC } from '../data/itinerary';
import { dLabel } from '../lib/dates';
import { store, useTripState } from '../state/store';

export function BookingList({ onEdit }: { onEdit: (id?: string, date?: string) => void }) {
  const state = useTripState();
  const groups = useMemo(() => { const map = new Map<string, typeof state.bookings>(); state.bookings.forEach(b => map.set(b.date, [...(map.get(b.date) ?? []), b])); return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)); }, [state.bookings]);
  const unbooked = DAYS.filter(d => d.stay !== 'In the air' && !state.bookings.some(b => b.type === 'stay' && b.date === d.d));
  return <div>{unbooked.length > 0 && <div className="alert"><b>{unbooked.length} nights still need a stay</b>This currently over-reports multi-night stays logged on one date; Plan 3 fixes the booking model.</div>}{groups.map(([date, bookings]) => <section key={date} className="booking-group"><div className="sect-h"><h2>{dLabel(date)}</h2></div>{bookings.map(booking => <article className="card pad booking-card" key={booking.id}><div className="row"><span className="tag">{booking.type}</span><strong>{booking.name}</strong><span className="sp" /><button className="btn ghost sm" onClick={() => onEdit(booking.id)}>Edit</button></div>{booking.addr && <p className="hint">{booking.addr}</p>}{booking.conf && <p className="mono">Confirmation {booking.conf}</p>}{booking.addr && <a href={`https://maps.google.com/?q=${encodeURIComponent(booking.addr)}`} target="_blank" rel="noreferrer">Open in Maps</a>}</article>)}</section>)}<section className="sect-h"><h2>Receipts &amp; tickets</h2></section>{state.docs.length ? state.docs.map(doc => <div className="card pad" key={doc.id}>{doc.label}</div>) : <div className="empty card"><p>No receipts or tickets yet.</p></div>}<button className="btn" onClick={() => onEdit(undefined, DAYS[0]?.d)}>Add booking</button></div>;
}
