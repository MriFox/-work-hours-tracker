/* 牛马计时器 PWA - Service Worker
 * 策略：
 *   · 页面/文档、js、css  → Network First（拿不到网络才回退缓存）
 *   · 图片、字体          → Cache First（命中即用，后台静默更新）
 *   · 跨域资源（Google Fonts 等）→ Cache First + 后台更新
 *
 * APP_VERSION bump 的作用：CACHE_NAME 由它拼成，activate 时会删掉所有旧缓存。
 * 图片/字体走 Cache First，不 bump 就永远吃旧图；js/css 虽是 Network First，
 * 但首次离线前的那份缓存也要靠它换新。改静态资源就顺手加一，成本极低。
 */
var APP_VERSION = '4.5.1';
var CACHE_NAME = 'work-hours-v' + APP_VERSION;
var STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './js/utils.js',
  './js/state.js',
  './js/theme.js',
  './js/app.js',
  './js/pages/login.js',
  './js/pages/wizard.js',
  './js/pages/record.js',
  './js/pages/week.js',
  './js/pages/month.js',
  './js/pages/quarter.js',
  './js/components/toast.js',
  './js/components/confirm.js',
  './js/components/date-picker.js',
  './js/components/time-picker.js',
  './css/design-system.css',
  './css/pages.css',
  './css/picker.css',
  './css/toast.css',
  './css/a11y.css',
  './icons/icon-16x16.png',
  './icons/icon-32x32.png',
  './icons/icon-48x48.png',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-256x256.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './favicon.ico',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/favicon.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) { return cache.addAll(STATIC_ASSETS); })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
          .map(function(n) { return caches.delete(n); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);

  // 外部资源（Google Fonts 等）：缓存优先，后台更新
  if (url.origin !== self.location.origin) {
    event.respondWith(cacheFirstWithNetworkUpdate(event.request));
    return;
  }

  // 静态资源（图标、字体）：缓存优先
  if (event.request.destination === 'image' || event.request.destination === 'font') {
    event.respondWith(cacheFirstWithNetworkUpdate(event.request));
    return;
  }

  // 页面/文档：网络优先，缓存兜底
  event.respondWith(networkFirstWithFallback(event.request));
});

// 缓存优先 + 后台更新
function cacheFirstWithNetworkUpdate(request) {
  return caches.match(request).then(function(cached) {
    if (cached) {
      fetch(request).then(function(response) {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then(function(cache) { cache.put(request, response); });
        }
      }).catch(function() {});
      return cached;
    }
    return fetch(request).then(function(response) {
      if (response && response.ok) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
      }
      return response;
    }).catch(function() { return new Response('Offline', {status: 503}); });
  });
}

// 网络优先 + 缓存兜底
function networkFirstWithFallback(request) {
  return fetch(request).then(function(response) {
    if (response && response.ok) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
    }
    return response;
  }).catch(function() {
    return caches.match(request).then(function(cached) {
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return caches.match('./index.html');
      }
      return new Response('离线模式', {status: 503});
    });
  });
}
