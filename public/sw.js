const CACHE_NAME = 'servicelog-v4';
const STATIC_CACHE = 'servicelog-static-v4';

// static assets ที่ cache ได้นาน (มี hash ใน filename)
const isHashedAsset = (url) => /\/assets\/.+\.[a-f0-9]{8}\.(js|css)$/.test(url);
// icons และ manifest cache ได้
const isStaticFile = (url) => /\.(png|ico|json|svg)$/.test(url);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(['/', '/index.html'])));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME && k !== STATIC_CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith('http')) return;

  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // ── Hashed assets (JS/CSS bundle) → Cache First ──
  // Vite สร้าง hash ใน filename เสมอ ถ้า cache มีอยู่แล้วใช้เลย
  if (isSameOrigin && isHashedAsset(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(c => c.put(e.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── Icons/manifest → Cache First ──
  if (isSameOrigin && isStaticFile(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(c => c.put(e.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── HTML และทุกอย่างที่เหลือ → Network First ──
  // โหลดจาก network เสมอ ใช้ cache เฉพาะตอนออฟไลน์
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response && response.status === 200 && isSameOrigin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then(cached => cached || Response.error()))
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
