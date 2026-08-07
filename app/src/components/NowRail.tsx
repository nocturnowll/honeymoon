import { DAYS } from '../data/itinerary';
import { itemKey, mins } from '../lib/dates';
import { store, useTripState } from '../state/store';

export function NowRail({ index }: { index: number }) {
  const state = useTripState(); const day = DAYS[index]; if (!day) return null;
  const now = new Date(); const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const items = day.s.map((item, itemIndex) => ({ item, itemIndex, time: state.items[itemKey(index, itemIndex)]?.t ?? item[0] })).sort((a, b) => mins(a.time) - mins(b.time));
  let current = -1; items.forEach((entry, i) => { if (mins(entry.time) <= currentMinutes) current = i; });
  const next = items[current + 1]; const visible = items.slice(Math.max(0, current - 1), Math.min(items.length, current + 4));
  return <div className="now"><div className="lbl">Day {index + 1} · {day.leg}</div><h2>{day.t}</h2><div className="sub">{day.stay} · sunrise {day.sr} · sunset {day.ss}{day.drive !== '—' ? ` · ${day.drive} driving` : ''}</div><div className="rail">{visible.map(entry => { const isCurrent = items[current]?.itemIndex === entry.itemIndex; const done = state.done[itemKey(index, entry.itemIndex)]; return <div className={`ri ${isCurrent ? 'now-i' : ''} ${done ? 'done' : ''}`} key={entry.itemIndex}><div className="t">{entry.time}</div><div className="x"><b>{entry.item[1]}</b>{isCurrent && next && <div className="cd">next in {Math.max(0, mins(next.time) - currentMinutes)} min</div>}</div></div>; })}</div></div>;
}
