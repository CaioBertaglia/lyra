/**
 * Lyra — Service Worker (PWA)
 * Estratégia: Cache-First para assets estáticos, Network-First para dados.
 */

const CACHE   = 'lyra-v2-shell';
const OFFLINE = '/offline.html';

const PRECACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/models.js',
  './js/core/event-bus.js',
  './js/services/storage.service.js',
  './js/services/spotify.service.js',
  './js/modules/setlist-manager.js',
  './js/modules/show-timer.js',
  './js/modules/ui-components.js',
  './js/modules/renderer.js',
  './manifest.json',
];

// ── Install: pré-carrega shell ────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: limpa caches antigos ────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-First para assets, Network-First para API ────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Deixa Spotify API passar direto (sem cache)
  if (url.hostname.includes('spotify.com') || url.hostname.includes('accounts.spotify')) {
    return;
  }

  // Cache-First para assets do app
  if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request)
        .then(cached => cached ?? fetch(e.request)
          .then(res => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then(c => c.put(e.request, clone));
            }
            return res;
          })
          .catch(() => caches.match('./index.html'))
        )
    );
  }
});
EOF

