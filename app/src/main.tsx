import './styles/tokens.css';
import './styles/base.css';

import { createRoot } from 'react-dom/client';
import { App } from './App';
import { store } from './state/store';

store.startAuto();
window.addEventListener('online', () => void store.sync(true));
window.addEventListener('pagehide', () => store.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { store.flush(); return; }
  void store.sync(true);
});

createRoot(document.getElementById('root')!).render(<App />);
