/* Offline cache. Large stretches of this route have no signal:
   Tioga Road, most of Death Valley, the Utah highways, Zion canyon. */
const V='larch-canyon-v1';
const ASSETS=['./','./index.html','./manifest.json','./assets/icon.png',
  './assets/maps/overview.png','./assets/maps/canada.png','./assets/maps/sierra.png',
  './assets/maps/utah.png','./assets/maps/la.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(V).then(c=>c.addAll(ASSETS).catch(()=>{})).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET')return;
  // never cache weather - it must be live or absent
  if(u.hostname.includes('open-meteo')||u.hostname.includes('api.github.com'))return;
  e.respondWith(
    caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{
      if(r.ok&&u.origin===location.origin){const c=r.clone();caches.open(V).then(k=>k.put(e.request,c))}
      return r;
    }).catch(()=>hit))
  );
});
