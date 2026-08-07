import { useEffect, useState } from 'react';
import { FX } from '../lib/fx';

export function RateStrip() {
  const [, redraw] = useState(0);
  useEffect(() => { void FX.refresh().then(() => redraw(value => value + 1)); }, []);
  return <div className="card pad rate-strip"><div className="row"><div><div className="eyebrow">Mid-market rates</div><strong>USD {FX.idr('USD').toLocaleString()} IDR</strong><span className="hint"> · CAD {FX.idr('CAD').toFixed(0)} IDR</span></div><span className="sp" /><span className={`tag ${FX.stale ? 'canyon' : 'ok'}`}>{FX.stale ? 'cached' : 'live'}</span><button className="btn ghost sm" onClick={() => void FX.refresh(true).then(() => redraw(value => value + 1))}>Refresh</button></div><p className="hint">{FX.age()} · your cards settle above mid-market.</p></div>;
}
