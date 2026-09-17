// 데이헝거 서비스 워커: 오프라인에서도 "혼자 하기"가 되도록 정적 파일을 캐시합니다.
// 네트워크 우선, 실패하면 캐시. 협동(/ws)은 건드리지 않습니다.
const CACHE = 'dayhunger-v1';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './client/css/style.css',
  './client/js/main.js', './client/js/view.js', './client/js/net.js', './client/js/input.js', './client/js/renderer.js', './client/js/ui.js', './client/js/config.js',
  './shared/constants.js', './shared/game.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/ws') || url.pathname.endsWith('/health')) return;
  e.respondWith(fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
