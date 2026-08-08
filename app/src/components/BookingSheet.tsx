import { useEffect, useState } from 'react';
import { DAYS } from '../data/itinerary';
import { Sheet } from './Sheet';
import { store, useTripState, usePhotoRevision } from '../state/store';
import { nightsCovered } from '../lib/bookings';
import { processAttachment } from '../lib/image';
import type { Booking, PhotoRef } from '../state/schema';

/** Live "N nights" readout under the date pickers. `end` may legitimately be
 *  unset (single night, the pre-range model), or entered backwards/equal to
 *  `date` — nightsCovered degrades that to one night rather than throwing,
 *  but the sheet still tells the user their range didn't make sense instead
 *  of silently reinterpreting it. */
function rangeHint(date?: string, end?: string): string {
  if (!date) return 'Pick a start date';
  if (!end) return '1 night';
  if (end <= date) return 'End must be after the start date — showing 1 night';
  const n = nightsCovered({ date, end }).length;
  return `${n} night${n === 1 ? '' : 's'} · checkout ${end}`;
}

/** Object URLs for not-yet-saved files, revoked as soon as the selection
 *  changes or the sheet unmounts — same lifecycle `OutfitSheet` uses for its
 *  single-file previews, just over an array. */
function useFilePreviews(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = files.map(f => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach(u => URL.revokeObjectURL(u));
  }, [files]);
  return urls;
}

const isPdfType = (type: string | null) => type === 'application/pdf';

/** One already-saved attachment: an image thumbnail, or a labelled chip for
 *  a PDF that opens via its object URL — iOS renders that natively. Also
 *  used, without `onRemove`, by `BookingList` to show a saved confirmation
 *  right on the booking card, not only inside this edit sheet. */
export function SavedAttachment({ file, onRemove }: { file: PhotoRef; onRemove?: () => void }) {
  const url = store.photoUrl(file);
  if (!url) return null;
  return <div className="attach-item">
    {isPdfType(store.photoType(file))
      ? <a className="attach-pdf" href={url} target="_blank" rel="noreferrer">PDF</a>
      : <img className="attach-thumb" src={url} alt="Booking attachment" />}
    {onRemove && <button type="button" className="attach-remove" aria-label="Remove attachment" onClick={onRemove}>×</button>}
  </div>;
}

/** A file picked this session but not yet uploaded. */
function PendingAttachment({ file, url, onRemove }: { file: File; url: string; onRemove: () => void }) {
  return <div className="attach-item">
    {isPdfType(file.type)
      ? <a className="attach-pdf" href={url} target="_blank" rel="noreferrer">PDF</a>
      : <img className="attach-thumb" src={url} alt="Selected attachment" />}
    <button type="button" className="attach-remove" aria-label="Remove attachment" onClick={onRemove}>×</button>
  </div>;
}

export function BookingSheet({ id, presetDate, onClose }: { id?: string; presetDate?: string; onClose: () => void }) {
  const state = useTripState();
  usePhotoRevision();
  const existing = state.bookings.find(b => b.id === id);
  const [draft, setDraft] = useState<Partial<Booking>>(existing ?? { id: crypto.randomUUID(), type: 'stay', name: '', date: presetDate ?? DAYS[0]?.d ?? '', addr: '' });
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newPreviews = useFilePreviews(newFiles);
  const keptFiles = (existing?.files ?? []).filter(f => !removedIds.has(f.p));

  const save = async () => {
    setSaving(true); setError(null);
    const created: PhotoRef[] = [];
    try {
      const uploaded: PhotoRef[] = [];
      for (const file of newFiles) {
        const ref = await store.addLocalPhoto(await processAttachment(file));
        created.push(ref); uploaded.push(ref);
      }
      const value = { ...draft, files: [...keptFiles, ...uploaded] } as Booking;
      store.mutate('bookings', value.id!, s => { const index = s.bookings.findIndex(b => b.id === value.id); if (index >= 0) s.bookings[index] = value; else s.bookings.push(value); });
      const dropped = (existing?.files ?? []).filter(f => removedIds.has(f.p));
      onClose();
      void Promise.all(dropped.map(ref => store.removeLocalPhoto(ref))).catch(() => undefined);
    } catch (cause) {
      await Promise.allSettled(created.map(ref => store.removeLocalPhoto(ref)));
      setError(cause instanceof Error ? cause.message : 'That attachment could not be saved. Try a smaller file.');
    } finally {
      setSaving(false);
    }
  };

  /** Removing the booking must also release every attachment it held, or
   *  the blob sits orphaned in IndexedDB until `sweepOrphans` next runs. */
  const remove = () => {
    if (!existing) return;
    if (!confirm(`Delete "${existing.name}"? This can't be undone.`)) return;
    const files = existing.files ?? [];
    store.mutate('bookings', existing.id, s => { s.bookings = s.bookings.filter(b => b.id !== existing.id); });
    onClose();
    void Promise.all(files.map(ref => store.removeLocalPhoto(ref))).catch(() => undefined);
  };

  return <Sheet open onClose={onClose} title={existing ? 'Edit booking' : 'Add booking'}>
    <label className="f"><span>Type</span><select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as Booking['type'] })}><option value="stay">Stay</option><option value="car">Car</option><option value="fly">Flight</option><option value="act">Activity</option><option value="eat">Food</option></select></label>
    <label className="f"><span>Name</span><input value={draft.name ?? ''} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
    <div className="grid2">
      <label className="f"><span>From</span><input type="date" value={draft.date ?? ''} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
      <label className="f"><span>To</span><input type="date" value={draft.end ?? ''} onChange={e => setDraft({ ...draft, end: e.target.value || undefined })} /></label>
    </div>
    <p className="hint">{rangeHint(draft.date, draft.end)}</p>
    <label className="f"><span>Address</span><input value={draft.addr ?? ''} onChange={e => setDraft({ ...draft, addr: e.target.value })} /></label>
    <label className="f"><span>Confirmation</span><input value={draft.conf ?? ''} onChange={e => setDraft({ ...draft, conf: e.target.value })} /></label>
    <details className="acc" open={!!(draft.checkin || draft.checkout)}>
      <summary>Times (optional)</summary>
      <div className="ab grid2">
        <label className="f"><span>Check-in</span><input type="time" value={draft.checkin ?? ''} onChange={e => setDraft({ ...draft, checkin: e.target.value || undefined })} /></label>
        <label className="f"><span>Check-out</span><input type="time" value={draft.checkout ?? ''} onChange={e => setDraft({ ...draft, checkout: e.target.value || undefined })} /></label>
      </div>
    </details>
    <div className="f attach-field">
      <span>Attachments</span>
      <p className="hint">Confirmation, receipt or boarding pass — photos or PDFs, and more than one is fine.</p>
      {(keptFiles.length > 0 || newFiles.length > 0) && <div className="attach-list">
        {keptFiles.map(file => <SavedAttachment key={file.p} file={file} onRemove={() => setRemovedIds(prev => new Set(prev).add(file.p))} />)}
        {newFiles.map((file, index) => newPreviews[index] && <PendingAttachment key={`${file.name}-${index}`} file={file} url={newPreviews[index]} onRemove={() => setNewFiles(prev => prev.filter((_, i) => i !== index))} />)}
      </div>}
      <label className="attach-add">
        <input type="file" accept="image/*,application/pdf" multiple onChange={e => { const picked = Array.from(e.target.files ?? []); if (picked.length) setNewFiles(prev => [...prev, ...picked]); e.target.value = ''; }} />
        <span className="btn ghost sm">Add attachment</span>
      </label>
    </div>
    {error && <div className="alert"><b>Could not save</b>{error}</div>}
    <div className="row">
      <button className="btn" disabled={!draft.name || !draft.date || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save booking'}</button>
      <button className="btn ghost" onClick={onClose}>Cancel</button>
      {existing && <button className="btn warn" onClick={remove}>Delete</button>}
    </div>
  </Sheet>;
}
