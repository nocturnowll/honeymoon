import { DAYS } from '../data/itinerary';
import { navigate } from '../lib/router';
import { TripMap } from '../components/TripMap';

/** First day index whose base matches, i.e. where a tapped pin's itinerary begins.
 *  Waypoints (e.g. Death Valley) have no day based there — findIndex returns -1 and
 *  the tap is a no-op rather than routing to a bogus day. */
function firstDayForBase(base: string): number {
  return DAYS.findIndex((d) => d.base === base);
}

export function Map() {
  function onPinTap(base: string) {
    const index = firstDayForBase(base);
    if (index >= 0) navigate(`#/itinerary/day/${index}`);
  }
  return (
    <section>
      <div className="route-heading">
        <div className="eyebrow">The whole route</div>
        <h1>Map</h1>
        <p className="hint">Pinch to zoom, drag to pan. Tap a pin to jump to that place in the itinerary.</p>
      </div>
      <TripMap onPinTap={onPinTap} />
      <div className="map-legend">
        <span><i className="map-legend-dot on-route" aria-hidden="true" /> Overnight base</span>
        <span><i className="map-legend-dot waypoint" aria-hidden="true" /> Waypoint</span>
        <span><i className="map-legend-line" aria-hidden="true" /> Route</span>
      </div>
    </section>
  );
}
