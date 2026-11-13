const CACHE_NAME = 'control-battle-shell-v2';
const CORE_FILES = [
  './', './index.html',
  './flags/egypt.png','./flags/france.png','./flags/germany.png','./flags/iraq.png',
  './flags/jordan.png','./flags/kuwait.png','./flags/lebanon.png','./flags/palestine.png',
  './flags/qatar.png','./flags/russia.png','./flags/saudi.png','./flags/syria.png',
  './flags/turkey.png','./flags/uae.png','./flags/uk.png','./flags/usa.png',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js'
];
self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_FILES.map(async url=>{
      try { const req=new Request(url,{mode:url.startsWith('http')?'no-cors':'same-origin'}); const res=await fetch(req); if(res && (res.ok || res.type==='opaque')) await cache.put(req,res); } catch(_) {}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('control-battle-')&&k!==CACHE_NAME).map(k=>caches.delete(k)));await self.clients.claim();})());
});
self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  const isGameAsset=url.origin===self.location.origin || url.hostname==='cdnjs.cloudflare.com' || url.hostname==='cdn.jsdelivr.net';
  if(!isGameAsset) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(req,{ignoreSearch:true});
    if(cached) return cached;
    try { const fresh=await fetch(req); if(fresh && (fresh.ok || fresh.type==='opaque')) cache.put(req,fresh.clone()).catch(()=>{}); return fresh; }
    catch(err){ if(cached) return cached; throw err; }
  })());
});
