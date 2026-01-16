importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

if (workbox) {
  console.log(`Workbox is loaded`);

  // Force verbose logging for development/debugging
  workbox.setConfig({ debug: true });

  // --- Caching Strategies ---

  // 1. HTML, JS, CSS, JSON (Game Logic & Data) - StaleWhileRevalidate
  // We want these to update fairly quickly if you push a new version, 
  // but load instantly from cache first.
  workbox.routing.registerRoute(
    ({request, url}) => {
      return (
        request.destination === 'document' ||
        request.destination === 'script' ||
        request.destination === 'style' ||
        url.pathname.endsWith('.json')
      );
    },
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'game-core',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        }),
      ],
    })
  );

  // 2. Images, Audio, Fonts (Static Assets) - CacheFirst
  // These rarely change. Valid for 30 days.
  workbox.routing.registerRoute(
    ({request, url}) => {
      return (
        request.destination === 'image' ||
        request.destination === 'audio' ||
        request.destination === 'font' ||
        url.pathname.includes('/img/') ||
        url.pathname.includes('/audio/') ||
        url.pathname.includes('/fonts/') ||
        url.pathname.includes('/icon/')
      );
    },
    new workbox.strategies.CacheFirst({
      cacheName: 'game-assets',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 500, // Games have many files
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // Offline fallback (Optional but good practice)
  // For a single page app/game, we just rely on index.html being cached above.

} else {
  console.log(`Workbox didn't load`);
}

// Skip waiting to activate the new SW immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
