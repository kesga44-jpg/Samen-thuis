const CACHE_NAME = 'samen-thuis-static-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './tokens.css',
  './base.css',
  './layout.css',
  './components.css',
  './data-core.js?v=3',
  './app.js?v=4',
  './utils.js',
  './state.js',
  './api.js',
  './rendering.js',
  './handlers.js',
  './icon.svg',
  './jacket.svg',
  './layers.svg',
  './light.svg',
  './rain.svg',
  './warm.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('samen-thuis-static-') && key !== CACHE_NAME)
      .map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || caches.match('./index.html')));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    return response;
  })));
});
