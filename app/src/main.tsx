import './styles/tokens.css';
import './styles/base.css';

import { createRoot } from 'react-dom/client';
import { App } from './App';
import { store } from './state/store';

if (import.meta.env.VITE_SYNC_ENABLED === '1') {
  store.startAuto();
  window.addEventListener('online', () => void store.sync(true));
  window.addEventListener('pagehide', () => store.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { store.flush(); return; }
    void store.sync(true);
  });
} else {
  console.warn('[larch-canyon] Foundation build: sync is disabled. This page shares an origin with the live app and must not write to the data repo before cutover.');
}

createRoot(document.getElementById('root')!).render(<App />);
