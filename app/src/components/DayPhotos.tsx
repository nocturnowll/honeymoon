import { DAYS, LOC } from '../data/itinerary';
import { store, usePhotoRevision, useTripSelector } from '../state/store';

export function DayPhotos({ index }: { index: number }) {
  const photos = useTripSelector(state => state.photos);
  usePhotoRevision();
  const day = DAYS[index];
  if (!day?.ph.length) return null;
  return <><div className="eyebrow photo-heading">Photos — {LOC[day.base]?.n}</div><div className="pgrid">{day.ph.map(([name, place], photoIndex) => { const key = `${index}.${photoIndex}`; const src = store.photoUrl(photos[key]); return <div className="pslot" key={key}>{src ? <><img src={src} alt={name} /><div className="cap">{name}</div></> : <><div className="plus">+</div><div className="ph">{name}<br />{place}</div></>}</div>; })}</div><p className="hint">Tap a slot to add your own photo. Reference shots can be added when photo editing is wired in.</p></>;
}
