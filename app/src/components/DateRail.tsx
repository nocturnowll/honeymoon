import { useEffect, useRef } from 'react';
import { DAYS } from '../data/itinerary';
import { dShort } from '../lib/dates';

export function DateRail({ selected, onSelect }: { selected: number; onSelect: (index: number) => void }) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, [selected]);
  return <div className="date-rail" aria-label="Trip days">{DAYS.map((day, index) => { const short = dShort(day.d); return <button key={day.d} ref={index === selected ? selectedRef : undefined} className={index === selected ? 'selected' : ''} onClick={() => onSelect(index)}><b>{short.dd}</b><small>{short.mm}</small></button>; })}</div>;
}
