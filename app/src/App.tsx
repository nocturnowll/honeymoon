import { useState } from 'react';
import { Header } from './components/Header';
import { Nav } from './components/Nav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useRoute } from './lib/router';
import { Now } from './routes/Now';
import { Itinerary } from './routes/Itinerary';
import { Budget } from './routes/Budget';
import { Lists } from './routes/Lists';
import { Map } from './routes/Map';
import { SettingsSheet } from './components/SettingsSheet';

export function App() {
  const route = useRoute();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const screen = {
    now: <Now />,
    itinerary: <Itinerary initialDay={route.params.day ? Number(route.params.day) : undefined} />,
    budget: <Budget />,
    lists: <Lists />,
    map: <Map />,
  }[route.tab];
  return <>
    <Header onSettings={() => setSettingsOpen(true)} />
    <Nav active={route.tab} />
    <main><ErrorBoundary label={route.tab}>{screen}</ErrorBoundary></main>
    <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
  </>;
}
