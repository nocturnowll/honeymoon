import { useState } from 'react';
import { Sheet } from './Sheet';
import { store, useTripState } from '../state/store';
import type { Spend } from '../state/schema';

export function SpendSheet({ onClose }: { onClose: () => void }) {
  const state = useTripState(); const [draft, setDraft] = useState<Spend>({ id: crypto.randomUUID(), what: '', amt: 0, cur: 'USD', card: state.cards[0]?.id, date: new Date().toISOString().slice(0, 10) });
  return <Sheet open onClose={onClose} title="Add spend"><label className="f"><span>What</span><input value={draft.what ?? ''} onChange={e => setDraft({ ...draft, what: e.target.value })} /></label><div className="grid2"><label className="f"><span>Amount</span><input type="number" step="0.01" value={draft.amt} onChange={e => setDraft({ ...draft, amt: Number(e.target.value) })} /></label><label className="f"><span>Currency</span><select value={draft.cur} onChange={e => setDraft({ ...draft, cur: e.target.value })}><option>USD</option><option>CAD</option><option>IDR</option></select></label></div><label className="f"><span>Card or cash</span><select value={draft.card ?? ''} onChange={e => setDraft({ ...draft, card: e.target.value || undefined })}><option value="">Unassigned</option>{state.cards.map(card => <option key={card.id} value={card.id}>{card.nick}</option>)}</select></label><label className="f"><span>Date</span><input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label><button className="btn" disabled={!draft.what || draft.amt <= 0} onClick={() => { store.mutate('spend', draft.id, s => { s.spend.push(draft); }); onClose(); }}>Save spend</button></Sheet>;
}
