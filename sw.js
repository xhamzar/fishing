// === CONFIG =======================================
const BASE = self.location.pathname.replace(/sw\.js$/, '');  

// Ubah setiap kali rilis versi baru
const CACHE_VERSION = 'v4';  
const CACHE = 'fishing-' + CACHE_VERSION;

const ASSETS = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}styles.css`,
  `${BASE}app.js`,
  `${BASE}manifest.json`,
  `${BASE}img/arapaima.png`,
  `${BASE}img/blue_catfish.png`,
  // Tambahkan semua asset lain:
  // `${BASE}img/xxx.png`,
  // `${BASE}icons/icon-192.png`,
  // `${BASE}icons/icon-512.png`,
];
// ====================================================


// INSTALL → Precache assets
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );

  // SW langsung aktif
  self.skipWaiting();
});


// ACTIVATE → Hapus cache lama + auto reload halaman
self.addEventListener('activate', async evt => {
  // Hapus cache lama
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE) return caches.delete(key);
        })
      )
    )
  );

  // SW baru mengambil alih
  self.clients.claim();

  // === AUTO UPDATE ===
  // Refresh semua tab agar pakai versi baru
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) {
    client.navigate(client.url);
  }
});


// FETCH HANDLER
self.addEventListener('fetch', evt => {
  const req = evt.request;

  // Fallback navigasi ke index.html (SPA mode)
  if (req.mode === 'navigate') {
    evt.respondWith(
      fetch(req).catch(() => caches.match(`${BASE}index.html`))
    );
    return;
  }

  // Cache-first
  evt.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req).catch(() => {
        if (req.destination === 'image') {
          return caches.match(`${BASE}img/placeholder.png`);
        }
      });
    })
  );
});