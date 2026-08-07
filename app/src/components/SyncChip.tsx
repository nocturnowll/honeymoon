import { useTripState, store } from '../state/store';

export function SyncChip() {
  useTripState();
  const status = store.status();
  const syncEnabled = import.meta.env.VITE_SYNC_ENABLED === '1';
  let label = 'sync off';
  let className = 'chip';
  if (syncEnabled) {
    if (status.saveFailed) { label = 'not saved'; className += ' bad'; }
    else if (status.error) { label = 'sync error'; className += ' bad'; }
    else if (status.busy) { label = 'syncing'; className += ' busy'; }
    else if (status.last) { label = 'synced'; className += ' good'; }
    else if (status.configured) label = 'local only';
  }
  return <span className={className} title={status.error ?? undefined}>{label}</span>;
}
