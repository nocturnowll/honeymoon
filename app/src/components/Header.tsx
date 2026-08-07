import { tripPhase } from '../lib/dates';
import { navigate } from '../lib/router';
import { SyncChip } from './SyncChip';

export function Header({ onSettings }: { onSettings: () => void }) {
  const phase = tripPhase();
  const stat = phase.p === 'before' ? phase.n : phase.p === 'during' ? phase.n : phase.n;
  const label = phase.p === 'before' ? 'to departure' : phase.p === 'during' ? 'trip day' : 'days home';
  return <header>
    <div className="hrow">
      <button className="brand" onClick={() => navigate('#/now')} aria-label="Go to Now">
        Larch &amp; Canyon
        <small>Kenny &amp; Hershania · Sep–Oct 2026</small>
      </button>
      <div className="hstat"><b>{stat}</b><span>{label}</span><br /><SyncChip /></div>
      <button className="header-gear" onClick={onSettings} aria-label="Open settings">⚙</button>
    </div>
  </header>;
}
