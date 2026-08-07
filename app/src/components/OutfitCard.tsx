import { useState } from 'react';
import type { Outfit, PhotoRef } from '../state/schema';
import { store, usePhotoRevision } from '../state/store';
import { OutfitSheet } from './OutfitSheet';

function PhotoThumbnail({ photo, src, label }: { photo: PhotoRef | undefined; src: string; label: string }) {
  if (!photo) return null;
  return <img className="outfit-thumbnail" src={src} alt={label} />;
}

export function OutfitCard({ outfit, base, dateSpan }: { outfit: Outfit | undefined; base: string; dateSpan: string }) {
  const [open, setOpen] = useState(false);
  usePhotoRevision();
  const hasPhoto = !!(outfit?.img || outfit?.img2);
  const thumbnails = [
    { photo: outfit?.img, label: 'Main outfit' },
    { photo: outfit?.img2, label: 'Alternate outfit' },
  ].map(item => ({ ...item, src: store.photoUrl(item.photo) })).filter((item): item is typeof item & { src: string } => !!item.src);
  return <>
    <div className="outfit-card card pad">
      <div className="eyebrow">Outfit · {base}</div>
      <div className="row"><strong>{outfit?.pieces || 'No outfit plan yet'}</strong><span className="tag">{dateSpan}</span></div>
      {thumbnails.length > 0 && <div className="outfit-thumbnails" aria-label="Saved outfit photos">
        {thumbnails.map(photo => <PhotoThumbnail key={photo.label} photo={photo.photo} src={photo.src} label={photo.label} />)}
      </div>}
      {outfit?.note && <p className="hint">{outfit.note}</p>}
      {hasPhoto && <p className="hint">{outfit.img2 ? '2 outfit photos saved' : '1 outfit photo saved'}</p>}
      <button className="btn ghost sm outfit-edit" onClick={() => setOpen(true)}>{outfit ? 'Edit outfit plan' : 'Plan outfit'}</button>
    </div>
    {open && <OutfitSheet base={base} dateSpan={dateSpan} existing={outfit} onClose={() => setOpen(false)} />}
  </>;
}
