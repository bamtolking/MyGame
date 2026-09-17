// 서비스 워커: 오프라인 플레이 + 홈 화면 설치 (stale-while-revalidate)
const VERSION = 'crimson-exile-v2';
const FILES = ['./', './index.html', './manifest.json', './css/style.css',
  './js/config.js', './js/utils.js', './js/daynight.js', './js/audio.js', './js/input.js', './js/data_items.js', './js/items.js',
  './js/data_gems.js', './js/passives.js', './js/stats.js', './js/skills.js', './js/entities.js', './js/player.js', './js/combat.js',
  './js/monsters.js', './js/world.js', './js/ui.js', './js/touch.js', './js/save.js', './js/game.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const same = new URL(e.request.url).origin === location.origin;
  e.respondWith(caches.open(VERSION).then(async c => {
    const cached = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(res => { if (res && res.ok && same) c.put(e.request, res.clone()); return res; }).catch(() => null);
    return cached || (await net) || c.match('./index.html');
  }));
});
