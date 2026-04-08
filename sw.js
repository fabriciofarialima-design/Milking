const IMG_CACHE = 'milking-images-v2';
const STATIC_CACHE = 'milking-static-v2';
const MAX_IMG_ENTRIES = 200;

// Padrões para match de assets estáticos
const STATIC_PATTERNS = [
  'products.js',
  'Logo-milking-liners.svg',
  'Background-hero'
];

// Install: ativa imediatamente
self.addEventListener('install', () => self.skipWaiting());

// Activate: limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== IMG_CACHE && k !== STATIC_CACHE)
            .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Limita o número de entradas no cache de imagens
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
    if (keys.length - 1 > maxEntries) trimCache(cacheName, maxEntries);
  }
}

// Fetch: estratégia diferenciada por tipo
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Imagens do S3 — cache first + limite de entradas
  if (url.hostname.includes('pedidook.s3')) {
    event.respondWith(
      caches.open(IMG_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
              trimCache(IMG_CACHE, MAX_IMG_ENTRIES);
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // Assets estáticos do site — stale-while-revalidate
  if (STATIC_PATTERNS.some(p => url.pathname.includes(p))) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request).then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
          return cached || fetchPromise;
        })
      )
    );
    return;
  }
});
