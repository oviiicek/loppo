// Offline cache: network first for the page, cache first for hashed assets.
// A new build's asset replaces the older builds of the same file, so the cache does not grow with every release.
const CACHE = 'loppo-v1';
// 'assets/index-DcaLdK2V.js' -> 'assets/index.js' (Vite adds an 8 character hash)
const stem = (path) => path.replace(/-[A-Za-z0-9_-]{8}(\.\w+)$/, '$1');

function dropOlderBuilds(c, url) {
  const path = new URL(url).pathname;
  if (!path.includes('/assets/')) return;
  const s = stem(path);
  c.keys().then((keys) =>
    keys.forEach((k) => {
      const p = new URL(k.url).pathname;
      if (p !== path && p.includes('/assets/') && stem(p) === s) c.delete(k);
    }),
  );
}

// leftovers of older releases: only the newest cached build of each asset stays
function keepNewest(c) {
  return c.keys().then((keys) => {
    const newest = new Map();
    for (const k of keys) {
      const p = new URL(k.url).pathname;
      if (p.includes('/assets/')) newest.set(stem(p), k.url);
    }
    return Promise.all(keys.filter((k) => new URL(k.url).pathname.includes('/assets/') && newest.get(stem(new URL(k.url).pathname)) !== k.url).map((k) => c.delete(k)));
  });
}

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icons/icon-192.png'])).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => caches.open(CACHE))
      .then(keepNewest)
      .catch(() => {})
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate';
  if (isPage) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy).then(() => dropOlderBuilds(c, req.url)));
          }
          return res;
        }),
    ),
  );
});
