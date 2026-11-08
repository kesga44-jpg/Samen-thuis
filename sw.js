// Service worker Samen Thuis. Versiebeheer: verhoog CACHE bij elke wijziging in index.html of een asset-versie (?v=).
// sw-assets.test.js controleert dat elke stylesheet en elk script uit index.html hier voorkomt (offline volledig).
const CACHE='samen-thuis-v43-voeding';
const ASSETS=['./','./index.html','./css/tokens.css?v=249','./css/base.css?v=249','./css/layout.css?v=252','./css/components.css?v=249','./styles.css?v=256','./sportcoach.css?v=2','./shell.css?v=3','./css/personalization.css?v=5','./css/finance.css?v=1','./css/nutrition.css?v=1','./cdn-libs.js?v=1','./data-core.js?v=249','./savings-core.js?v=1','./offers-core.js?v=5','./dashboard-core.js?v=3','./chalkboard-core.js?v=1','./household-sync-core.js?v=2','./personal-preferences-core.js?v=4','./budget-ledger-core.js?v=3','./finance-plan-core.js?v=1','./finance-ui.js?v=1','./quotes-core.js?v=2','./rewards-core.js?v=1','./freezer-core.js?v=1','./weather-advice-core.js?v=1','./sportcoach-core.js?v=2','./nav-core.js?v=3','./search-core.js?v=2','./import-core.js?v=1','./import-readers.js?v=1','./food-facts-core.js?v=1','./nutrition-core.js?v=1','./osta-exchange-core.js?v=1','./app.js?v=275','./samen-thuis-update-v26-challenges.js?v=260','./account-sync.js?v=3','./inbox-core.js?v=1','./inbox.js?v=1','./weather-extras.js?v=1','./sportcoach.js?v=6','./nutrition.js?v=1','./nav-groups.js?v=3','./search.js?v=1','./manifest.webmanifest','./icon.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  // Externe bronnen (Supabase, Open-Meteo, Open Food Facts, CDN) gaan rechtstreeks; die hebben eigen caches in de app.
  if(url.origin!==location.origin){ event.respondWith(fetch(event.request)); return; }
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});

// Samen Thuis v26.0
