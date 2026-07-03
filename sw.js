// ===== SERVICE WORKER - TechIntervention PWA =====
const CACHE_NAME = 'techintervention-v1';

// Fichiers à mettre en cache pour fonctionner hors ligne
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Librairies CDN
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/signature_pad@4.1.7/dist/signature_pad.umd.min.js'
];

// Installation : mise en cache de tous les assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mise en cache des fichiers');
      // On cache les fichiers locaux en priorité, les CDN en best-effort
      const localAssets = ASSETS.filter(url => !url.startsWith('http'));
      const cdnAssets = ASSETS.filter(url => url.startsWith('http'));

      return cache.addAll(localAssets).then(() => {
        // CDN en parallèle, on ignore les erreurs réseau
        return Promise.allSettled(
          cdnAssets.map(url => cache.add(url).catch(() => {}))
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Suppression ancien cache :', key);
              return caches.delete(key);
            })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch : stratégie Cache First (offline first)
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET et les extensions Chrome
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Retourner le cache, et mettre à jour en arrière-plan si en ligne
        const fetchUpdate = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
            }
            return response;
          })
          .catch(() => {});
        return cached;
      }

      // Pas en cache : essayer le réseau
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200) return response;
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          // Offline et pas en cache : retourner la page principale
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
