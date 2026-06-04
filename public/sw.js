const CACHE_NAME = 'servicelog-v3';
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

// ── FCM Push ──
self.addEventListener('push', e => {
  let payload = {};
  try { payload = e.data ? e.data.json() : {}; }
  catch (_) { payload = { notification: { title: 'ServiceLog', body: e.data ? e.data.text() : '' } }; }

  const n = payload.notification || payload.data || payload || {};
  const title = n.title || 'ServiceLog';
  const options = {
    body: n.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {},
    tag: (payload.data && payload.data.caseId) || undefined,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
