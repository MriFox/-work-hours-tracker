/* 工时记录 PWA - Service Worker
 * 策略: Network First (页面) + Cache First (静态资源) + 外部资源专门处理
 */
var APP_VERSION = '3.3.1';
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
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png',
  './icons/icon-512-maskable.png'
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
