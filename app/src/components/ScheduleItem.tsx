import { useState } from 'react';
import type { ScheduleItem as ScheduleItemData } from '../data/itinerary';
import { itemKey } from '../lib/dates';
import { store, useTripSelector } from '../state/store';

export function ScheduleItem({ dayIndex, itemIndex, item }: { dayIndex: number; itemIndex: number; item: ScheduleItemData }) {
  const key = itemKey(dayIndex, itemIndex);
  const done = useTripSelector(state => !!state.done[key]);
  const editedTime = useTripSelector(state => state.items[key]?.t);
  const current = editedTime ?? item[0];
  const [editing, setEditing] = useState(false);
  return <div className={`si ${item[3] === 'k' ? 'key' : ''} ${done ? 'done' : ''}`}>
    <label className="check-hit" aria-label={`Mark ${item[1]} ${done ? 'not done' : 'done'}`}><input type="checkbox" checked={done} onChange={e => store.mutate('done', key, s => { s.done[key] = e.target.checked; })} /></label>
    {editing ? <input className="time-input" type="time" value={current} autoFocus onBlur={() => setEditing(false)} onChange={e => store.mutate('items', key, s => { s.items[key] = { t: e.target.value }; })} /> : <button className="tt" onClick={() => setEditing(true)} title="Adjust time">{current}{editedTime ? '*' : ''}</button>}
    <div className="bd"><b>{item[1]}</b>{item[2] && <span className="no">{item[2]}</span>}</div>
  </div>;
}
