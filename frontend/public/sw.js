/* Kartavya Service Worker — PWA offline support */
const CACHE = 'kartavya-v2';
const PRECACHE = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

/* Push notification handler — fires when backend sends a Web Push message */
self.addEventListener('push', (e) => {
  let data = { title: 'Kartavya', body: 'You have a new notification.' };
  try { data = e.data?.json() ?? data; } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  '/logo192.png',
      badge: '/logo192.png',
      data:  { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const match = cs.find(c => c.url.includes(self.location.origin));
      if (match) return match.focus().then(c => c.navigate(url));
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Only cache same-origin requests — skip cross-origin (fonts, CDN) to avoid opaque response bloat
  if (new URL(e.request.url).origin !== self.location.origin) return;
  if (e.request.url.includes('/api/')) return; // never cache API calls

  // Network-first: always try the network so a new deploy is picked up on a
  // normal refresh, not just a hard refresh. Cache is only a fallback for when
  // the network request fails (offline) — never the primary source, otherwise
  // stale JS/CSS bundles get served forever after every deploy.
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.status === 200 && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
      }
      return res;
    }).catch(() =>
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        // Only fall back to the app shell for navigation requests, not for assets/XHR
        if (e.request.mode === 'navigate') return caches.match('/index.html');
        return new Response('', { status: 408, statusText: 'Offline' });
      })
    )
  );
});



