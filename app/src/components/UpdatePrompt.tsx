import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Service-worker update notice. Ports the behaviour of the legacy app's
 * `index.html:2129-2145`: when a new build has installed and is waiting,
 * tell the user, skip waiting, and reload — automatically, no click
 * required, matching what was already shipping.
 */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new build on every load, same as the legacy `reg.update()`.
      registration?.update().catch(() => {});
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    const t = setTimeout(() => { void updateServiceWorker(true); }, 1200);
    return () => clearTimeout(t);
  }, [needRefresh, updateServiceWorker]);

  if (!needRefresh) return null;

  return (
    <div role="status" aria-live="polite" className="update-toast">
      New version ready — reopening
    </div>
  );
}
