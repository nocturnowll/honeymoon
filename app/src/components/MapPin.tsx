// A single trip base, drawn as a small dot with a label. The visible glyph is
// tiny (a ~10px dot) but the tap target underneath is the platform minimum —
// this app has already had one accessibility finding for a control below 44px.
const HIT_RADIUS = 22; // 44px diameter, matching --tap in tokens.css

export interface MapPinProps {
  x: number;
  y: number;
  label: string;
  /** Overnight base on the route, vs. a waypoint (Death Valley) with no day based there. */
  onRoute: boolean;
  onTap?: () => void;
}

export function MapPin({ x, y, label, onRoute, onTap }: MapPinProps) {
  const clickable = !!onTap;
  return (
    <g
      className={`map-pin ${onRoute ? 'on-route' : 'waypoint'}`}
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? label : undefined}
      onClick={clickable ? onTap : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onTap!();
              }
            }
          : undefined
      }
    >
      {clickable && <circle className="map-pin-hit" r={HIT_RADIUS} />}
      <circle className="map-pin-dot" r={5} />
      <text className="map-pin-label" y={-11}>
        {label}
      </text>
    </g>
  );
}
