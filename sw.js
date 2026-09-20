// The page itself comes from the network whenever the network answers, so a
// deploy is visible on the next open instead of the one after. Icons and the
// manifest stay cache-first. Offline, everything falls back to the cache.
const CACHE = 'togethr-v4';
const SHELL = ['.', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const save = (req, res) => {
  const copy = res.clone();
  caches.open(CACHE).then(c => c.put(req, copy));
  return res;
};

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Never cache the GitHub API — sync must always hit the network
  if (e.request.method !== 'GET' || url.hostname === 'api.github.com') return;

  const isPage = e.request.mode === 'navigate'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('/index.html');

  if (isPage) {
    e.respondWith(
      fetch(e.request)
        .then(res => res.ok ? save(e.request, res) : res)
        .catch(() => caches.match(e.request).then(hit => hit || caches.match('index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => {
      const live = fetch(e.request)
        .then(res => res.ok ? save(e.request, res) : res)
        .catch(() => hit);
      return hit || live;
    })
  );
});
