import { useState } from 'react';
import type { Outfit } from '../state/schema';
import { usePhotoRevision } from '../state/store';
import { OutfitSheet } from './OutfitSheet';

export function OutfitCard({ outfit, base, dateSpan }: { outfit: Outfit | undefined; base: string; dateSpan: string }) {
  const [open, setOpen] = useState(false);
  usePhotoRevision();
  const hasPhoto = !!(outfit?.img || outfit?.img2);
  return <>
    <div className="outfit-card card pad">
      <div className="eyebrow">Outfit · {base}</div>
      <div className="row"><strong>{outfit?.pieces || 'No outfit plan yet'}</strong><span className="tag">{dateSpan}</span></div>
      {outfit?.note && <p className="hint">{outfit.note}</p>}
      {hasPhoto && <p className="hint">{outfit.img2 ? '2 outfit photos saved' : '1 outfit photo saved'}</p>}
      <button className="btn ghost sm outfit-edit" onClick={() => setOpen(true)}>{outfit ? 'Edit outfit plan' : 'Plan outfit'}</button>
    </div>
    {open && <OutfitSheet base={base} dateSpan={dateSpan} existing={outfit} onClose={() => setOpen(false)} />}
  </>;
}
