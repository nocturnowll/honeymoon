import { useEffect, useState } from 'react';
import { DAYS, LOC, TRIP, TODOS } from '../data/itinerary';
import { currentDayIdx, daysBetween, dLabel, itemKey, mins, tripPhase, todayISO } from '../lib/dates';
import { bookingsOnDate } from '../lib/bookings';
import { loadWeather, weatherNote, type WeatherDay } from '../lib/weather';
import { useTripState } from '../state/store';
import { NowRail } from '../components/NowRail';
import { WeatherStrip } from '../components/WeatherStrip';
import { DayCard } from '../components/DayCard';

export function Now() {
  const state = useTripState(); const [, rerender] = useState(0); const phase = tripPhase(); const index = currentDayIdx(); const [weather, setWeather] = useState<WeatherDay[]>([]);
  useEffect(() => { const timer = phase.p === 'during' ? window.setInterval(() => rerender(value => value + 1), 60_000) : undefined; return () => { if (timer) window.clearInterval(timer); }; }, [phase.p]);
  useEffect(() => { const start = index >= 0 ? index : 0; void loadWeather(DAYS.slice(start, start + 7), LOC).then(setWeather); }, [index]);
  const nextTodos = TODOS.flatMap(([, items]) => items as [string, string][]).filter(([text]) => !state.todos[text]).sort((a, b) => a[1].localeCompare(b[1])).slice(0, 4);
  const todayBookings = index >= 0 && DAYS[index] ? bookingsOnDate(state.bookings, DAYS[index].d) : [];
  const arrivalItems = index >= 0 ? DAYS[index]?.s.filter(item => /check in|arrive|drop bags/i.test(item[1])) ?? [] : [];
  return <section><div className="route-heading"><div className="eyebrow">Daily driver</div><h1>Now</h1></div>{phase.p === 'before' && <div className="now"><div className="lbl">Departure</div><h2>{phase.n} days to go</h2><div className="sub">BR 238 leaves Jakarta 14:30 on {dLabel(TRIP.start)}</div><div className="rail">{nextTodos.map(([text, due]) => <div className="ri" key={text}><div className="t">{daysBetween(todayISO(), due)}d</div><div className="x">{text}</div></div>)}</div></div>}{phase.p === 'during' && index >= 0 && <NowRail index={index} />}{phase.p === 'during' && index < 0 && <div className="now"><div className="lbl">In transit</div><h2>Between days</h2><div className="sub">No scheduled day matches today’s date.</div></div>}{phase.p === 'after' && <div className="now"><div className="lbl">Complete</div><h2>Welcome home</h2><div className="sub">22 days, 6 national parks, 3,555 km. Your scrapbook and receipts are still here.</div></div>}<div className="sect-h"><h2>Weather</h2><span className="n">{weather.length ? weatherNote(weather) : 'loading'}</span></div>{weather.length ? <WeatherStrip days={weather} /> : <div className="empty card"><p>Loading forecast…</p></div>}{index >= 0 && <><div className="sect-h"><h2>Today</h2></div>{todayBookings.map(booking => { const arrival = arrivalItems[0]; const warning = booking.type === 'stay' && booking.checkin && arrival && mins(arrival[0]) < mins(booking.checkin); return <div className={`alert ${warning ? '' : 'ok'}`} key={booking.id}><b>{booking.name}</b>{booking.addr && <>{booking.addr}<br /></>}{booking.conf && <>Ref {booking.conf}</>}{booking.checkin && <> · in {booking.checkin}</>}{booking.checkout && <> · out {booking.checkout}</>}{warning && <><br /><b>Check-in is {booking.checkin} but you arrive {arrival[0]}.</b> Ask about early check-in or bag drop.</>}</div>; })}<DayCard index={index} open onToggle={() => undefined} onBooking={() => undefined} /></>}
</section>;
}
