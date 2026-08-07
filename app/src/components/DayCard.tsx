import { dLabel, dShort, itemKey } from '../lib/dates';
import { LOC, DAYS } from '../data/itinerary';
import { store, useTripSelector } from '../state/store';
import { ScheduleItem } from './ScheduleItem';
import { DayPhotos } from './DayPhotos';

function dayDoneCount(done: Record<string, boolean>, index: number): number {
  return DAYS[index]?.s.filter((_, itemIndex) => done[itemKey(index, itemIndex)]).length ?? 0;
}

export function DayCard({ index, open, onToggle, onBooking }: { index: number; open: boolean; onToggle: () => void; onBooking: () => void }) {
  const done = useTripSelector(state => dayDoneCount(state.done, index));
  const note = useTripSelector(state => state.notes[String(index)]);

  const day = DAYS[index];
  if (!day) return null;
  const short = dShort(day.d);
  return <article className={`day ${day.d === new Date().toISOString().slice(0, 10) ? 'today' : ''} ${open ? 'open' : ''}`} id={`day-${index}`}>
    <button className="dh" onClick={onToggle} aria-expanded={open}>
      <span className="dnum">{short.dd}<small>{short.mm}</small></span>
      <span className="dt"><h3>{day.t}</h3><p>{LOC[day.base]?.n}, {LOC[day.base]?.a} · {day.drive} · {done}/{day.s.length}</p><span className="prog"><i style={{ width: `${day.s.length ? done / day.s.length * 100 : 0}%` }} /></span></span>
      <span aria-hidden="true" className="chev">⌄</span>
    </button>
    {open && <div className="dbody">
      <div className="row"><span className="tag glacier">↑ {day.sr}</span><span className="tag larch">↓ {day.ss}</span><span className="tag">{day.stay}</span></div>
      {day.s.map((item, itemIndex) => <ScheduleItem key={itemKey(index, itemIndex)} dayIndex={index} itemIndex={itemIndex} item={item} />)}
      <DayPhotos index={index} />
      <div className="row"><button className="btn ghost sm" onClick={() => { const value = window.prompt('Day note', note ?? ''); if (value != null) store.mutate('notes', index, s => { s.notes[String(index)] = value; }); }}>{note ? 'Edit note' : 'Add note'}</button><button className="btn ghost sm" onClick={onBooking}>Add booking</button></div>
      {note && <div className="alert info"><b>Your note</b>{note}</div>}
      <p className="hint">{dLabel(day.d)}</p>
    </div>}
  </article>;
}
