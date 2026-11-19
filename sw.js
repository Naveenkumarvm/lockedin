// Locked In - Service Worker
const CACHE_NAME = 'lockedin-cache-v6';

const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './config.js',
  './manifest.webmanifest',
  './logo.svg',
  './logo-white.svg',
  './logo-sm.svg',
  './logo-sm-white.svg',
  './og-image.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png',
  './css/base.css',
  './css/layout.css',
  './css/today.css',
  './css/learning-log.css',
  './css/report.css',
  './css/timetable.css',
  './css/modals.css',
  './js/crypto.js',
  './js/state.js',
  './js/storage.js',
  './js/ui.js',
  './js/auth.js',
  './js/today.js',
  './js/learning-log.js',
  './js/report.js',
  './js/timetable.js',
  './js/alarms.js',
  './js/backup.js',
  './js/drive.js',
  './fonts/SpaceGrotesk.ttf',
  './fonts/Inter-Regular.woff2',
  './fonts/Inter-SemiBold.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  const url = new URL(event.request.url);

  // Always use network for Google APIs or external identity endpoints
  if (url.origin.includes('google') || url.origin.includes('googleapis')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first specifically against current active cache version
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Stale-while-revalidate for local assets
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse);
              }
            })
            .catch(() => {});
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          cache.put(event.request, responseToCache);
          return networkResponse;
        });
      });
    }).catch(() => {
      if (event.request.mode === 'navigate') {
        return caches.open(CACHE_NAME).then(c => c.match('./index.html'));
      }
    })
  );
});

// System Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  const data = event.notification.data || {};

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    let appClient = null;

    for (const client of clientList) {
      if ('focus' in client) {
        appClient = client;
        break;
      }
    }

    if (action === 'snooze') {
      if (appClient) {
        appClient.postMessage({
          type: 'ALARM_ACTION',
          action: 'snooze',
          blockId: data.blockId,
          data: data
        });
        await appClient.focus();
      } else {
        const newClient = await self.clients.openWindow('./');
        if (newClient) await newClient.focus();
      }
    } else if (action === 'done') {
      if (appClient) {
        appClient.postMessage({
          type: 'ALARM_ACTION',
          action: 'done',
          blockId: data.blockId,
          data: data
        });
        await appClient.focus();
      } else {
        const newClient = await self.clients.openWindow('./');
        if (newClient) await newClient.focus();
      }
    } else {
      // Body click: open or focus app
      if (appClient) {
        appClient.postMessage({
          type: 'ALARM_ACTION',
          action: 'focus',
          blockId: data.blockId,
          data: data
        });
        await appClient.focus();
      } else {
        await self.clients.openWindow('./');
      }
    }
  })());
});
