const CACHE_NAME = 'servicelog-v2';
const urlsToCache = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // ข้าม non-GET และ chrome-extension
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // ถ้า response ไม่ ok (เช่น 401, 404) → คืนตรงๆ ไม่ cache
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        // cache เฉพาะ same-origin static assets
        const url = new URL(e.request.url);
        if (url.origin === self.location.origin) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // offline fallback
        return caches.match(e.request).then(cached => cached || Response.error());
      })
  );
});
