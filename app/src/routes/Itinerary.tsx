import { useEffect, useMemo, useState } from 'react';
import { DAYS } from '../data/itinerary';
import { navigate } from '../lib/router';
import { DateRail } from '../components/DateRail';
import { PlaceHeader } from '../components/PlaceHeader';
import { DayCard } from '../components/DayCard';
import { BookingList } from '../components/BookingList';
import { BookingSheet } from '../components/BookingSheet';

export function Itinerary({ initialDay }: { initialDay?: number }) {
  const [selected, setSelected] = useState(Math.min(Math.max(initialDay ?? 0, 0), DAYS.length - 1));
  const [open, setOpen] = useState<number | null>(initialDay ?? null);
  const [segment, setSegment] = useState<'days' | 'bookings'>('days');
  const [booking, setBooking] = useState<{ id?: string; date?: string } | null>(null);
  useEffect(() => { if (initialDay == null) return; setSelected(initialDay); setOpen(initialDay); requestAnimationFrame(() => document.getElementById(`day-${initialDay}`)?.scrollIntoView({ block: 'start' })); }, [initialDay]);
  const groups = useMemo(() => { const output: { base: string; indexes: number[] }[] = []; DAYS.forEach((day, index) => { const last = output[output.length - 1]; if (last?.base === day.base) last.indexes.push(index); else output.push({ base: day.base, indexes: [index] }); }); return output; }, []);
  return <section><div className="route-heading"><div className="eyebrow">The road book</div><h1>Itinerary</h1><p className="hint">Leg → place → day. Tap a day to open its schedule.</p></div><div className="segment"><button className={segment === 'days' ? 'selected' : ''} onClick={() => setSegment('days')}>Days</button><button className={segment === 'bookings' ? 'selected' : ''} onClick={() => setSegment('bookings')}>Bookings</button></div>{segment === 'bookings' ? <BookingList onEdit={(id, date) => setBooking({ id, date })} /> : <><DateRail selected={selected} onSelect={index => { setSelected(index); setOpen(index); navigate(`#/itinerary/day/${index}`); document.getElementById(`day-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} />{groups.map(group => <div key={group.base}><PlaceHeader base={group.base} dayIndexes={group.indexes} />{group.indexes.map(index => <DayCard key={DAYS[index].d} index={index} open={open === index} onToggle={() => { setOpen(open === index ? null : index); setSelected(index); }} onBooking={() => setBooking({ date: DAYS[index].d })} />)}</div>)}</>}{booking && <BookingSheet id={booking.id} presetDate={booking.date} onClose={() => setBooking(null)} />}</section>;
}
