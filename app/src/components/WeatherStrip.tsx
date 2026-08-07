import type { WeatherDay } from '../lib/weather';
import { dShort } from '../lib/dates';
import { WX } from '../lib/weather';

export function WeatherStrip({ days }: { days: WeatherDay[] }) {
  return <div className="wx">{days.map(day => { const short = dShort(day.date); return <div className={`wxc ${day.est ? 'est' : ''}`} key={day.date}><div className="d">{short.dd} {short.mm}</div><div className="i">{day.est ? '≈' : WX.icon(day.code)}</div><div className="hi">{day.high}°</div><div className="lo">{day.low}°</div><div className="d">{day.place.slice(0, 9)}</div></div>; })}</div>;
}
