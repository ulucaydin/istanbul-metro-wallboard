const version = SHELL_VERSION;
const files = SHELL_FILES;
const scope = new URL(self.registration.scope);
const prefix = 'istanbul-wallboard:' + scope.pathname + ':';
const cacheName = prefix + version;
const shell = new URL('index.html', scope).href;
const assets = new Set(files.map(path => new URL(path, scope).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...assets].map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate' && url.origin === scope.origin
    && (url.pathname === scope.pathname || url.pathname === new URL(shell).pathname)) {
    event.respondWith((async () => {
      try {
        return await fetch(request, { signal: AbortSignal.timeout(4000) });
      } catch {
        const cache = await caches.open(cacheName);
        return (await cache.match(shell)) || Response.error();
      }
    })());
  } else if (assets.has(request.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      // These URLs are pinned build artifacts. Vary: Origin on a static host
      // must not make a cross-origin-mode module or stylesheet miss the cache.
      return (await cache.match(request, { ignoreVary: true })) || fetch(request);
    })());
  }
});
