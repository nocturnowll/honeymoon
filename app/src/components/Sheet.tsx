import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [offset, setOffset] = useState(0);
  const dragStart = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); returnFocus.current?.focus(); };
  }, [open]);
  if (!open) return null;
  return createPortal(<div className="modal on" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) { e.preventDefault(); closeRef.current(); } }}>
    <div ref={panel} className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
      style={{ transform: `translateY(${offset}px)` }}
      onTouchStart={e => { dragStart.current = e.touches[0]?.clientY ?? null; }}
      onTouchMove={e => { if (dragStart.current != null) setOffset(Math.max(0, e.touches[0].clientY - dragStart.current)); }}
      onTouchEnd={() => { if (offset > 100) onClose(); else setOffset(0); dragStart.current = null; }}>
      <button className="sheet-close" onClick={onClose} aria-label="Close">×</button>
      <div className="grip" aria-hidden="true" />
      {title && <h3>{title}</h3>}
      {children}
    </div>
  </div>, document.body);
}
