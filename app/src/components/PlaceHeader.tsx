import { DAYS, LOC } from '../data/itinerary';
import { dLabel } from '../lib/dates';
import { navigate } from '../lib/router';
import { useTripState } from '../state/store';
import { OutfitCard } from './OutfitCard';
import { TripMap } from './TripMap';

export function PlaceHeader({ base, dayIndexes }: { base: string; dayIndexes: number[] }) {
  const state = useTripState();
  const loc = LOC[base];
  const first = DAYS[dayIndexes[0]];
  const last = DAYS[dayIndexes[dayIndexes.length - 1]];
  if (!loc || !first || !last) return null;
  return <section className="place-header"><div className="eyebrow">{first.leg}</div><h2>{loc.n}</h2><p>{loc.a} · {dayIndexes.length} {dayIndexes.length === 1 ? 'night' : 'nights'} · {dLabel(first.d)}–{dLabel(last.d)}</p><span className="tag glacier">Climate {loc.cl[0]}–{loc.cl[1]}°C</span><button type="button" className="place-mini-map" onClick={() => navigate('#/map')} aria-label={`Open the full trip map, centred on ${loc.n}`}><TripMap legs={[base]} bases={[base]} interactive={false} /></button><OutfitCard base={base} outfit={state.outfits[base]} dateSpan={`${dLabel(first.d)}–${dLabel(last.d)}`} /></section>;
}
