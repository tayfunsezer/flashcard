// Offline support. Network first, so every online visit gets the latest files (no version to bump);
// when the network fails or is slow, the last copy saved in the cache is served instead.
// On install it saves index.html plus every local file it references (src= / href=), so a newly
// added script is picked up without editing this file. Every other local file is saved when first used.
const CACHE = 'offline-' + new URL(self.registration.scope).pathname;
const TIMEOUT_MS = 4000;

function localRefs(html) {
  const out = new Set(['./', 'index.html', 'manifest.webmanifest']);
  for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"'#?]+)/g)) {
    const u = new URL(m[1], self.registration.scope);
    if (u.origin === location.origin && u.pathname.startsWith(new URL(self.registration.scope).pathname)) out.add(u.href);
  }
  return [...out];
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch('index.html', { cache: 'no-store' });
    const urls = localRefs(await res.clone().text());
    await Promise.all(urls.map((u) => cache.add(new Request(u, { cache: 'no-store' })).catch(() => {})));
    await cache.put('index.html', res);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const key = req.mode === 'navigate' ? new URL(req.url).origin + new URL(req.url).pathname : req;
  const network = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok && res.type === 'basic') cache.put(key, res.clone());
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch (err) { /* offline: fall through to the cache */ }
  const hit = await cache.match(key, { ignoreSearch: true })
    || (req.mode === 'navigate' && await cache.match('index.html'));
  if (hit) return hit;
  return network; // nothing cached yet: wait for the network after all
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  e.respondWith(networkFirst(req));
});
