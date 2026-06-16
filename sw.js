// Service Worker - Dashboard Admin STPU ITU
// Cache name unik (admin-cache-v1) supaya tidak clash/overwrite
// dengan service worker repo lain (cth: tempah) yang mungkin
// guna nama generic seperti 'stpu-cache-v3'.

const CACHE_NAME = 'admin-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Network-first untuk panggilan GAS API, cache-first untuk shell files
self.addEventListener('fetch', function (event) {
  var url = event.request.url;

  if (url.indexOf('script.google.com') !== -1 || url.indexOf('script.googleusercontent.com') !== -1) {
    event.respondWith(
      fetch(event.request).catch(function () {
        return new Response(
          JSON.stringify({ ok: false, error: 'offline' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request).then(function (response) {
        return caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, response.clone());
          return response;
        });
      });
    }).catch(function () {
      return caches.match('./index.html');
    })
  );
});
