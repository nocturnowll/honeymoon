/* Offline cache.
   Network-first for the app shell so a new deploy is picked up immediately;
   cache-first only for assets that never change. Bump V on every release. */
const V='larch-canyon-2026.08.07-4';
const SHELL=['./','./index.html'];
const ASSETS=['./manifest.json','./assets/icon.png','./assets/maps/overview.png',
  './assets/maps/canada.png','./assets/maps/sierra.png','./assets/maps/utah.png',
  './assets/maps/la.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL.concat(ASSETS)).catch(()=>{}))
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('message',e=>{if(e.data==='skipWaiting')self.skipWaiting()});

self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET')return;
  // live data must never be cached
  if(u.hostname.includes('open-meteo')||u.hostname.includes('api.github.com')
     ||u.hostname.includes('er-api.com'))return;

  const isShell=e.request.mode==='navigate'||u.pathname.endsWith('/')
    ||u.pathname.endsWith('index.html');

  if(isShell){
    // network first: always try for a fresher build, fall back to cache offline
    e.respondWith(
      fetch(e.request).then(r=>{
        if(r&&r.ok){const c=r.clone();caches.open(V).then(k=>k.put(e.request,c))}
        return r;
      }).catch(()=>caches.match(e.request).then(hit=>hit||caches.match('./index.html')))
    );
    return;
  }
  // assets are immutable, so cache first is right for them
  e.respondWith(
    caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{
      if(r&&r.ok&&u.origin===location.origin){const c=r.clone();caches.open(V).then(k=>k.put(e.request,c))}
      return r;
    }).catch(()=>hit))
  );
});
