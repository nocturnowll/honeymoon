import { useState } from 'react';
import { PACKING, TODOS } from '../data/itinerary';
import { todayISO } from '../lib/dates';
import { store, useTripState } from '../state/store';
import { ChecklistItem } from '../components/ChecklistItem';

export function Lists() {
  const state = useTripState();
  const [segment, setSegment] = useState<'todo' | 'packing'>('todo');
  const groups = segment === 'todo' ? TODOS : PACKING;
  return <section><div className="route-heading"><div className="eyebrow">Preparation</div><h1>Lists</h1><p className="hint">Small checks now make the road days lighter.</p></div><div className="segment"><button className={segment === 'todo' ? 'selected' : ''} onClick={() => setSegment('todo')}>To do</button><button className={segment === 'packing' ? 'selected' : ''} onClick={() => setSegment('packing')}>Packing</button></div>{groups.map(([group, items]) => <details className="acc" key={group} open><summary>{group}<span className="tag">{items.length}</span></summary><div className="ab">{items.map(item => { const text = Array.isArray(item) ? item[0] : item; const due = Array.isArray(item) ? item[1] : undefined; const checked = segment === 'todo' ? !!state.todos[text] : !!state.packing[text]; const overdue = due != null && due < todayISO() && !checked; return <ChecklistItem key={text} label={text} due={due} overdue={overdue} checked={checked} onChange={value => store.mutate(segment === 'todo' ? 'todos' : 'packing', text, s => { s[segment === 'todo' ? 'todos' : 'packing'][text] = value; })} />; })}</div></details>)}</section>;
}
