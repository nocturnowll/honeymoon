import { useEffect, useState } from 'react';
import type { Outfit, PhotoRef } from '../state/schema';
import { store } from '../state/store';
import { Sheet } from './Sheet';
import { processImage } from '../lib/image';

interface OutfitSheetProps {
  base: string;
  dateSpan: string;
  existing?: Outfit;
  onClose: () => void;
}

function preview(ref: PhotoRef | undefined): string | null {
  return store.photoUrl(ref);
}

function useFilePreview(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

export function OutfitSheet({ base, dateSpan, existing, onClose }: OutfitSheetProps) {
  const [pieces, setPieces] = useState(existing?.pieces ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [main, setMain] = useState<File | null>(null);
  const [alternate, setAlternate] = useState<File | null>(null);
  const [clearMain, setClearMain] = useState(false);
  const [clearAlternate, setClearAlternate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mainPreview = useFilePreview(main);
  const alternatePreview = useFilePreview(alternate);

  useEffect(() => {
    setPieces(existing?.pieces ?? '');
    setNote(existing?.note ?? '');
    setMain(null);
    setAlternate(null);
    setClearMain(false);
    setClearAlternate(false);
    setError(null);
  }, [existing]);

  const save = async () => {
    setSaving(true);
    setError(null);
    const created: PhotoRef[] = [];
    try {
      const oldMain = existing?.img;
      const oldAlternate = existing?.img2;
      const img = main
        ? await store.addLocalPhoto(await processImage(main))
        : clearMain ? undefined : oldMain;
      if (main && img) created.push(img);
      const img2 = alternate
        ? await store.addLocalPhoto(await processImage(alternate))
        : clearAlternate ? undefined : oldAlternate;
      if (alternate && img2) created.push(img2);
      store.mutate('outfits', base, state => {
        state.outfits[base] = {
          ...(state.outfits[base] ?? {}),
          img,
          img2,
          pieces: pieces.trim(),
          note: note.trim(),
        };
      });
      onClose();
      const replaced = [
        main && oldMain ? oldMain : undefined,
        alternate && oldAlternate ? oldAlternate : undefined,
        clearMain && oldMain ? oldMain : undefined,
        clearAlternate && oldAlternate ? oldAlternate : undefined,
      ].filter((ref, index, refs): ref is PhotoRef => !!ref && refs.findIndex(item => item?.p === ref.p) === index);
      void Promise.all(replaced.map(ref => store.removeLocalPhoto(ref))).catch(() => undefined);
    } catch {
      await Promise.allSettled(created.map(ref => store.removeLocalPhoto(ref)));
      setError('That photo could not be saved. Try a smaller image.');
    } finally {
      setSaving(false);
    }
  };

  return <Sheet open onClose={onClose} title={`Plan outfits · ${base.toUpperCase()}`}>
    <p className="hint">For this destination ({dateSpan}). Add the looks you want to wear here, then use the day cards to check the weather and terrain. One plan applies to all days at this destination.</p>
    <div className="outfit-upload-grid">
      <div className="outfit-upload">
        <label htmlFor={`outfit-${base}-main`}>
          <span>Main look</span>
          <div className="outfit-preview">{mainPreview ? <img src={mainPreview} alt="Selected main outfit" /> : preview(existing?.img) && !clearMain ? <img src={preview(existing?.img)!} alt="Main outfit" /> : <b>＋</b>}</div>
          <input id={`outfit-${base}-main`} type="file" accept="image/*" onChange={event => setMain(event.target.files?.[0] ?? null)} />
          <small>{main ? main.name : existing?.img && !clearMain ? 'Replace photo' : 'Upload a photo'}</small>
        </label>
        {existing?.img && <button type="button" className="outfit-remove" onClick={() => setClearMain(value => !value)}>{clearMain ? 'Undo remove' : 'Remove photo'}</button>}
      </div>
      <div className="outfit-upload">
        <label htmlFor={`outfit-${base}-alternate`}>
          <span>Alternate look</span>
          <div className="outfit-preview">{alternatePreview ? <img src={alternatePreview} alt="Selected alternate outfit" /> : preview(existing?.img2) && !clearAlternate ? <img src={preview(existing?.img2)!} alt="Alternate outfit" /> : <b>＋</b>}</div>
          <input id={`outfit-${base}-alternate`} type="file" accept="image/*" onChange={event => setAlternate(event.target.files?.[0] ?? null)} />
          <small>{alternate ? alternate.name : existing?.img2 && !clearAlternate ? 'Replace photo' : 'Optional second look'}</small>
        </label>
        {existing?.img2 && <button type="button" className="outfit-remove" onClick={() => setClearAlternate(value => !value)}>{clearAlternate ? 'Undo remove' : 'Remove photo'}</button>}
      </div>
    </div>
    <label className="f"><span>Pieces to pack</span><textarea rows={4} value={pieces} onChange={event => setPieces(event.target.value)} placeholder="Cream knit, wide-leg denim, boots, rain shell" /></label>
    <label className="f"><span>Notes for the trip</span><textarea rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="Layer for sunrise; comfortable shoes for the trail" /></label>
    {error && <div className="alert"><b>Could not save</b>{error}</div>}      <div className="row"><button className="btn" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save outfit plan'}</button><button className="btn ghost" onClick={onClose}>Cancel</button></div>
    <p className="hint">Photos stay on this device while sync is off. They will be included in the shared data only when sync is enabled at cutover.</p>
  </Sheet>;
}
