// Offline cache for the installed web app (the dist/ build — the single-file play/index.html never registers it).
// BUILD and PRECACHE are stamped at build time (vite.config.ts, plugin sw-version): every build has its own cache name,
// so a new deploy is a changed sw.js → the browser installs it, it precaches the whole new build and drops the old cache.
//   pages (navigations): network first — a new deploy shows on the next online launch; offline or a slow network
//                        (> NAV_TIMEOUT_MS) gets this build's cached index.html
//   everything else:     this build's cache, else the network; a miss never answers with index.html (a script request
//                        getting HTML is a blank screen)
const BUILD = 'dev';
const PRECACHE = ['./', './index.html', './manifest.webmanifest'];
const CACHE = 'yasik-' + BUILD;
const NAV_TIMEOUT_MS = 3000;

self.addEventListener('install', e => {
  // cache: 'reload' skips the HTTP cache, so a stale copy from an earlier deploy never lands in this build's cache
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // drop earlier builds (only our own caches: the origin may host other apps)
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && (k.startsWith('yasik-') || k === 'malang-v1')).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(req.mode === 'navigate' ? page(req) : asset(req));
});

// (ignoreVary: one build's files never vary — and hosts that send "Vary: Origin" would make every module-script request,
// which carries an Origin header, miss the copy precached without one)
const MATCH = { ignoreSearch: true, ignoreVary: true };
function asset(req) {
  return caches.open(CACHE).then(c => c.match(req, MATCH)).then(hit => hit || fetch(req)).catch(() => Response.error());
}
function page(req) {
  const net = fetch(req);
  const cached = () => caches.open(CACHE)
    .then(c => c.match('./', MATCH).then(hit => hit || c.match('./index.html', MATCH)))
    // a navigation may not be answered with a redirected response (hosts that redirect / ↔ /index.html)
    .then(hit => (hit ? (hit.redirected ? new Response(hit.body, hit) : hit) : net));
  return new Promise(resolve => {
    let done = false;
    const settle = r => { if (!done) { done = true; clearTimeout(t); resolve(r); } };
    const t = setTimeout(() => settle(cached()), NAV_TIMEOUT_MS);
    net.then(settle, () => settle(cached()));
  });
}
