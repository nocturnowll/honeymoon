import { DAYS, LOC } from '../data/itinerary';
import { dLabel } from '../lib/dates';
import { useTripState } from '../state/store';
import { OutfitCard } from './OutfitCard';

export function PlaceHeader({ base, dayIndexes }: { base: string; dayIndexes: number[] }) {
  const state = useTripState();
  const loc = LOC[base];
  const first = DAYS[dayIndexes[0]];
  const last = DAYS[dayIndexes[dayIndexes.length - 1]];
  if (!loc || !first || !last) return null;
  return <section className="place-header"><div className="eyebrow">{first.leg}</div><h2>{loc.n}</h2><p>{loc.a} · {dayIndexes.length} {dayIndexes.length === 1 ? 'night' : 'nights'} · {dLabel(first.d)}–{dLabel(last.d)}</p><span className="tag glacier">Climate {loc.cl[0]}–{loc.cl[1]}°C</span><OutfitCard base={base} outfit={state.outfits[base]} dateSpan={`${dLabel(first.d)}–${dLabel(last.d)}`} /></section>;
}
