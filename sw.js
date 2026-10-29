const CACHE='samen-thuis-v25-8-nav5';
const ASSETS=['./','./index.html','./css/tokens.css?v=249','./css/base.css?v=249','./css/layout.css?v=251','./css/components.css?v=249','./styles.css?v=256','./data-core.js?v=249','./savings-core.js?v=1','./offers-core.js?v=5','./dashboard-core.js?v=3','./chalkboard-core.js?v=1','./personal-preferences-core.js?v=2','./budget-ledger-core.js?v=1','./quotes-core.js?v=1','./freezer-core.js?v=1','./nav-core.js?v=1','./household-sync-core.js?v=1','./account-sync.js?v=1','./inbox-core.js?v=1','./inbox.js?v=1','./weather-advice-core.js?v=1','./weather-extras.js?v=1','./nav-groups.js?v=1','./app.js?v=258','./samen-thuis-update-v26-challenges.js?v=260','./manifest.webmanifest','./icon.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin){ event.respondWith(fetch(event.request)); return; }
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});

// Samen Thuis v25.5
