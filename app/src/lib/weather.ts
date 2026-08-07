import type { Location } from '../data/itinerary';
import { dObj, dShort } from './dates';

export interface WeatherDay { high: number; low: number; code: number | null; est: boolean; date: string; place: string }

export const WX = {
  cache: {} as Record<string, Record<string, unknown>>,
  icon(code: number | null): string { if (code == null) return '○'; if (code === 0) return '☀'; if (code < 3) return '⛅'; if (code < 50) return '☁'; if (code < 60) return '🌧'; if (code < 70) return '🌦'; if (code < 80) return '🌨'; return '⛈'; },
  async fetch(loc: Location, from: string, to: string): Promise<Record<string, unknown> | null> {
    const key = `${loc.lat},${loc.lon},${from}`;
    if (this.cache[key]) return this.cache[key];
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&start_date=${from}&end_date=${to}`;
      const response = await fetch(url); if (!response.ok) throw new Error('weather request failed');
      const json = await response.json() as { daily?: Record<string, unknown> };
      this.cache[key] = json.daily ?? {}; return this.cache[key];
    } catch { return null; }
  },
};

export async function loadWeather(days: { d: string; base: string }[], locations: Record<string, Location>): Promise<WeatherDay[]> {
  const today = new Date(); const horizon = new Date(today.getTime() + 15 * 864e5); let live = 0;
  return Promise.all(days.map(async day => {
    const loc = locations[day.base]; const date = dObj(day.d); const inWindow = date >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) && date <= horizon;
    let high = loc.cl[1], low = loc.cl[0], code: number | null = null, est = true;
    if (inWindow) {
      const daily = await WX.fetch(loc, day.d, day.d);
      const highs = daily?.temperature_2m_max as number[] | undefined;
      const lows = daily?.temperature_2m_min as number[] | undefined;
      if (highs?.length && lows?.length) { high = Math.round(highs[0]); low = Math.round(lows[0]); code = (daily?.weather_code as number[] | undefined)?.[0] ?? null; est = false; live++; }
    }
    return { high, low, code, est, date: day.d, place: loc.n };
  })).then(result => result);
}
export function weatherNote(days: WeatherDay[]): string { const live = days.filter(day => !day.est).length; return live ? `${live} live · rest seasonal` : 'seasonal averages — live forecast from ~30 Aug'; }
export { dShort };
