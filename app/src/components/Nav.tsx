import { navigate, type RouteTab } from '../lib/router';

const icons: Record<RouteTab, string> = {
  now: '<path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="5"/>',
  itinerary: '<path d="M4 19h6a4 4 0 0 0 0-8H8a4 4 0 0 1 0-8h8"/><circle cx="4" cy="19" r="2"/><circle cx="18" cy="4" r="2"/>',
  budget: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
  lists: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3"/>',
  map: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 21"/>',
};
const tabs: [RouteTab, string][] = [['now', 'Now'], ['itinerary', 'Itinerary'], ['budget', 'Budget'], ['lists', 'Lists'], ['map', 'Map']];

export function Nav({ active }: { active: RouteTab }) {
  return <nav aria-label="Primary navigation">
    {tabs.map(([tab, label]) => <button key={tab} className={active === tab ? 'on' : ''}
      aria-current={active === tab ? 'page' : undefined} onClick={() => navigate(`#/${tab}`)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icons[tab] }} />
      <span>{label}</span>
    </button>)}
  </nav>;
}
