const CACHE='samen-thuis-v14-1-import-navigation-fix';
const ASSETS=[
  './','./index.html','./styles.css','./upgrade-v11.css','./app.js',
  './upgrade-v11.js','./samen-thuis-update-v4.js',
  './samen-thuis-update-v13.js','./samen-thuis-update-v14.js',
  './samen-thuis-update-v13.css','./manifest.webmanifest','./icon.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);

  if(url.origin!==location.origin){
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request,{cache:'no-store'})
      .then(response=>{
        if(response.ok){
          const copy=response.clone();
          event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));
        }
        return response;
      })
      .catch(()=>caches.match(event.request).then(cached=>{
        return cached || (event.request.mode==='navigate'
          ? caches.match('./index.html')
          : Response.error());
      }))
  );
});
