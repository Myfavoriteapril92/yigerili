/* 易个日历 · Service Worker
 * 目标：装上桌面后断网也能用（农历库与节假日表都在本地）。
 * 策略：页面走「网络优先、缓存兜底」，静态资源走「缓存优先」。
 */
var VERSION = 'ygl-v1';
var PRECACHE = VERSION + '-shell';
var RUNTIME = VERSION + '-assets';

var CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/lunar.js',
  './assets/js/app.js',
  './assets/js/chinese-days.js',
  './assets/data/chinese-days.json',
  './assets/images/image-1.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(PRECACHE).then(function (cache) {
      /* 单个资源取不到不应该让整个安装失败 */
      return Promise.all(
        CORE.map(function (url) {
          return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
        })
      );
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          if (k.indexOf('ygl-') !== 0 || (k !== PRECACHE && k !== RUNTIME)) {
            return caches.delete(k);
          }
        })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

function putInRuntime(req, res) {
  if (!res || res.status !== 200 || res.type === 'opaque') return res;
  var copy = res.clone();
  caches.open(RUNTIME).then(function (c) { c.put(req, copy); });
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; /* 外链交给浏览器 */

  /* 页面导航：网络优先，失败回退到已缓存的首页 */
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0) {
    e.respondWith(
      fetch(req).then(function (res) { return putInRuntime(req, res); })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match('./index.html');
          });
        })
    );
    return;
  }

  /* 其余静态资源：缓存优先，后台补齐 */
  e.respondWith(
    caches.match(req).then(function (hit) {
      var network = fetch(req).then(function (res) { return putInRuntime(req, res); })
        .catch(function () { return hit; });
      return hit || network;
    })
  );
});
