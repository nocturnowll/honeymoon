import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { BASES, ROUTE, fitBounds, project, unproject } from '../lib/geo';
import type { View } from '../lib/geo';
import { LOC } from '../data/itinerary';
import coastline from '../data/geo/coastline.json';
import borders from '../data/geo/borders.json';
import { MapPin } from './MapPin';

// Logical (viewBox) sizes. The rendered element is fluid (width:100%, aspect-ratio
// fixed in CSS), so these only set the coordinate system fitBounds/project work in —
// not the actual on-screen pixels.
const FULL_SIZE = { w: 390, h: 600 };
const MINI_SIZE = { w: 390, h: 200 };

// How many zoom levels past the initial fit the user may pinch in. Zooming OUT past
// the fit is disallowed entirely (min = fit zoom) so the trip can never shrink to a
// speck or wander off past the poles — that's the "sane clamp" the plan calls for.
const ZOOM_HEADROOM = 5;

// How close the nearest base must land to the edge of the frame when the safety net
// below pulls the view back — 0.8 of a half-screen, so the rescued base sits
// comfortably inside rather than balanced on the boundary. (0.99 was tested and is
// too tight: floating-point rounding on the projection can put the rescued base
// back outside by a hair. 0.7-0.95 all hold; 0.8 leaves margin on both sides.)
const RESCUE_FRACTION = 0.8;

type LineGeometry =
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'MultiLineString'; coordinates: [number, number][][] };
type GeoFeatureCollection = { type: 'FeatureCollection'; features: { geometry: LineGeometry }[] };

function lineToPath(coords: [number, number][], view: View): string {
  let d = '';
  for (let i = 0; i < coords.length; i++) {
    const [lon, lat] = coords[i];
    const p = project(lon, lat, view);
    d += `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)} `;
  }
  return d;
}

function geoPaths(fc: GeoFeatureCollection, view: View): string[] {
  const paths: string[] = [];
  for (const f of fc.features) {
    if (f.geometry.type === 'LineString') {
      paths.push(lineToPath(f.geometry.coordinates, view));
    } else {
      for (const line of f.geometry.coordinates) paths.push(lineToPath(line, view));
    }
  }
  return paths;
}

/** Shifts the view so the point under (dxLogical, dyLogical) of drag stays under the finger. */
export function panBy(view: View, dxLogical: number, dyLogical: number): View {
  const center = unproject(view.w / 2 - dxLogical, view.h / 2 - dyLogical, view);
  return { ...view, cx: center.lon, cy: center.lat };
}

/** Changes zoom while keeping the lon/lat under (anchorX, anchorY) fixed on screen. */
export function zoomAt(view: View, newZoom: number, anchorX: number, anchorY: number): View {
  const anchor = unproject(anchorX, anchorY, view);
  const zoomed: View = { ...view, zoom: newZoom };
  const p = project(anchor.lon, anchor.lat, zoomed);
  const center = unproject(zoomed.w / 2 + p.x - anchorX, zoomed.h / 2 + p.y - anchorY, zoomed);
  return { ...zoomed, cx: center.lon, cy: center.lat };
}

function isVisible(lon: number, lat: number, view: View): boolean {
  const p = project(lon, lat, view);
  return p.x >= 0 && p.x <= view.w && p.y >= 0 && p.y <= view.h;
}

/** The single funnel every pan and zoom path clamps through: zoom is bounded to
 *  [minZoom, maxZoom] first. Panning itself is intentionally NOT restricted — a
 *  bounding-box-plus-margin clamp was tried and measured to fail: TRIP_BOUNDS'
 *  corners are geometric extremes (SFO's longitude, Canmore's latitude, etc.), not
 *  places any base sits, so "stay within the rectangle" does not imply "a pin is
 *  reachable," especially once zoomAt's own re-centring (it moves cx/cy too, to
 *  keep the pinch anchor fixed) is added on top. Confirmed by simulating a pinch to
 *  every screen corner at max zoom: the rectangle clamp left zero bases visible in
 *  two of the four corners.
 *
 *  Instead this is a reactive safety net: if the view already shows at least one
 *  base, it is returned untouched — normal pan and zoom are fully unrestricted, at
 *  any zoom level. Only when a pan or zoom would leave *zero* bases on screen does
 *  it pull the centre back toward the nearest one, just far enough that it's
 *  comfortably back in frame. That is what stops the map being dragged into a
 *  permanently blank panel with no reset control and no way back — the failure
 *  mode this exists to prevent — without narrowing normal exploration at all. */
export function clampView(view: View, minZoom: number, maxZoom: number): View {
  const zoom = Math.min(Math.max(view.zoom, minZoom), maxZoom);
  const zoomed: View = { ...view, zoom };

  if (BASES.some((b) => isVisible(b.lon, b.lat, zoomed))) return zoomed;

  const halfLon = Math.abs(
    unproject(zoomed.w, zoomed.h / 2, zoomed).lon - unproject(zoomed.w / 2, zoomed.h / 2, zoomed).lon,
  );
  const halfLat = Math.abs(
    unproject(zoomed.w / 2, 0, zoomed).lat - unproject(zoomed.w / 2, zoomed.h / 2, zoomed).lat,
  );

  let nearest = BASES[0];
  let bestDistance = Infinity;
  for (const b of BASES) {
    // Distance normalised to the current viewport, so "nearest" means nearest to
    // being back on screen, not nearest in raw degrees (which would favour whichever
    // axis happens to be less foreshortened at this latitude).
    const d = Math.max(Math.abs(b.lon - zoomed.cx) / halfLon, Math.abs(b.lat - zoomed.cy) / halfLat);
    if (d < bestDistance) {
      bestDistance = d;
      nearest = b;
    }
  }

  const maxDx = halfLon * RESCUE_FRACTION;
  const maxDy = halfLat * RESCUE_FRACTION;
  const cx = Math.min(Math.max(zoomed.cx, nearest.lon - maxDx), nearest.lon + maxDx);
  const cy = Math.min(Math.max(zoomed.cy, nearest.lat - maxDy), nearest.lat + maxDy);
  return { ...zoomed, cx, cy };
}

interface GestureState {
  points: Map<number, { x: number; y: number }>;
  pinch: { distance: number; mid: { x: number; y: number } } | null;
}

export interface TripMapProps {
  /** Base keys to scope the view to — e.g. a single leg's base for the mini map in the
   *  itinerary place header. Unset (or empty) fits the whole trip. */
  legs?: string[];
  /** Base keys to render pins for. Unset renders all 12 of BASES. */
  bases?: string[];
  /** Full map (own tab) vs. mini (place header). false disables pan/zoom gestures and
   *  per-pin taps — a mini map is a static illustration; the caller wraps the whole
   *  thing in one tap target to open the full tab. */
  interactive?: boolean;
  onPinTap?: (baseKey: string) => void;
}

export function TripMap({ legs, bases, interactive = true, onPinTap }: TripMapProps) {
  const size = interactive ? FULL_SIZE : MINI_SIZE;
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<GestureState>({ points: new Map(), pinch: null });

  const scopeKey = legs && legs.length ? legs.join(',') : '';
  const fitPoints = useMemo(() => {
    if (!scopeKey) return BASES;
    const set = new Set(scopeKey.split(','));
    const scoped = BASES.filter((b) => set.has(b.key));
    return scoped.length ? scoped : BASES;
  }, [scopeKey]);

  const baseView = useMemo(() => fitBounds(fitPoints, size), [fitPoints, size.w, size.h]);
  const [view, setView] = useState<View>(baseView);
  useEffect(() => setView(baseView), [baseView]);

  const minZoom = baseView.zoom;
  const maxZoom = baseView.zoom + ZOOM_HEADROOM;

  // Heavy static geometry (coastline + borders, ~700 vertices) is projected once at
  // baseView and moved with a single SVG transform on pan/zoom, instead of re-running
  // project() over every vertex on every pointermove — that's what keeps a pinch
  // gesture smooth on a phone.
  const coastPaths = useMemo(
    () => geoPaths(coastline as unknown as GeoFeatureCollection, baseView),
    [baseView],
  );
  const borderPaths = useMemo(
    () => geoPaths(borders as unknown as GeoFeatureCollection, baseView),
    [baseView],
  );
  const routePath = useMemo(() => {
    const pts = ROUTE.map((key) => LOC[key]).filter(Boolean) as { lon: number; lat: number }[];
    return lineToPath(
      pts.map((p) => [p.lon, p.lat]),
      baseView,
    );
  }, [baseView]);

  const zoomFactor = Math.pow(2, view.zoom - baseView.zoom);
  const centerScreen = project(baseView.cx, baseView.cy, view);
  const tx = centerScreen.x - zoomFactor * (baseView.w / 2);
  const ty = centerScreen.y - zoomFactor * (baseView.h / 2);
  const worldTransform = `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${zoomFactor.toFixed(4)})`;

  const pinKeys = bases && bases.length ? bases : BASES.map((b) => b.key);
  const routeSet = useMemo(() => new Set(ROUTE), []);

  function rectScale() {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return { scaleX: 1, scaleY: 1, rect: { left: 0, top: 0 } };
    return { scaleX: size.w / rect.width, scaleY: size.h / rect.height, rect };
  }

  function toLogical(clientX: number, clientY: number) {
    const { scaleX, scaleY, rect } = rectScale();
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    gesture.current.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.current.points.size === 2) {
      const [p1, p2] = [...gesture.current.points.values()];
      gesture.current.pinch = {
        distance: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      };
    }
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const pts = gesture.current.points;
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId)!;
    const curr = { x: e.clientX, y: e.clientY };
    pts.set(e.pointerId, curr);

    if (pts.size === 1) {
      const { scaleX, scaleY } = rectScale();
      const dx = (curr.x - prev.x) * scaleX;
      const dy = (curr.y - prev.y) * scaleY;
      setView((v) => clampView(panBy(v, dx, dy), minZoom, maxZoom));
    } else if (pts.size === 2) {
      const [p1, p2] = [...pts.values()];
      const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const prevPinch = gesture.current.pinch;
      if (prevPinch && prevPinch.distance > 0) {
        const { scaleX, scaleY } = rectScale();
        const anchor = toLogical(prevPinch.mid.x, prevPinch.mid.y);
        const midDx = (mid.x - prevPinch.mid.x) * scaleX;
        const midDy = (mid.y - prevPinch.mid.y) * scaleY;
        setView((v) => {
          const ratio = distance / prevPinch.distance;
          const newZoom = Math.min(Math.max(v.zoom + Math.log2(ratio), minZoom), maxZoom);
          const zoomed = zoomAt(v, newZoom, anchor.x, anchor.y);
          return clampView(panBy(zoomed, midDx, midDy), minZoom, maxZoom);
        });
      }
      gesture.current.pinch = { distance, mid };
    }
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    gesture.current.points.delete(e.pointerId);
    if (gesture.current.points.size < 2) gesture.current.pinch = null;
  }

  return (
    <div className={`trip-map${interactive ? '' : ' trip-map-mini'}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="trip-map-canvas"
        role="img"
        aria-label="Trip map"
        // touch-action:none belongs on this canvas only. On the page it would stop
        // the tab from scrolling on a phone — the whole reason the plan calls it out.
        style={interactive ? { touchAction: 'none' } : undefined}
        onPointerDown={interactive ? onPointerDown : undefined}
        onPointerMove={interactive ? onPointerMove : undefined}
        onPointerUp={interactive ? onPointerUp : undefined}
        onPointerCancel={interactive ? onPointerUp : undefined}
        onPointerLeave={interactive ? onPointerUp : undefined}
      >
        <rect x={0} y={0} width={size.w} height={size.h} className="trip-map-bg" />
        <g transform={worldTransform}>
          <g className="trip-map-borders">
            {borderPaths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <g className="trip-map-coastline">
            {coastPaths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <path className="trip-map-route" d={routePath} />
        </g>
        {pinKeys.map((key) => {
          const loc = LOC[key];
          if (!loc) return null;
          const p = project(loc.lon, loc.lat, view);
          return (
            <MapPin
              key={key}
              x={p.x}
              y={p.y}
              label={loc.n}
              onRoute={routeSet.has(key)}
              onTap={interactive && onPinTap ? () => onPinTap(key) : undefined}
            />
          );
        })}
      </svg>
    </div>
  );
}
