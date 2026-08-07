import type { Outfit } from '../state/schema';

export function OutfitCard({ outfit, base, dateSpan }: { outfit: Outfit | undefined; base: string; dateSpan: string }) {
  return <div className="outfit-card card pad"><div className="eyebrow">Outfit · {base}</div><div className="row"><strong>{outfit?.pieces || 'No outfit packed yet'}</strong><span className="tag">{dateSpan}</span></div>{outfit?.note && <p className="hint">{outfit.note}</p>}</div>;
}
