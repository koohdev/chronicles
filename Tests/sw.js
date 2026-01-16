importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js"
);

if (workbox) {
  console.log(`Workbox is loaded`);

  // Force verbose logging for development/debugging
  workbox.setConfig({ debug: true });

  // --- Caching Strategies ---

  // 1. HTML, JS, CSS, JSON (Game Logic & Data) - StaleWhileRevalidate
  // We want these to update fairly quickly if you push a new version,
  // but load instantly from cache first.
  workbox.routing.registerRoute(
    ({ request, url }) => {
      return (
        request.destination === "document" ||
        request.destination === "script" ||
        request.destination === "style" ||
        url.pathname.endsWith(".json")
      );
    },
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: "game-core",
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
    ({ request, url }) => {
      return (
        request.destination === "image" ||
        request.destination === "audio" ||
        request.destination === "font" ||
        url.pathname.includes("/img/") ||
        url.pathname.includes("/audio/") ||
        url.pathname.includes("/fonts/") ||
        url.pathname.includes("/icon/")
      );
    },
    new workbox.strategies.CacheFirst({
      cacheName: "game-assets",
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
self.addEventListener("install", (event) => {
  self.skipWaiting();

  // Assets to precache
  const PRECACHE_ASSETS = [
    "./index.html",
    "./css/game.css",
    "./js/main.js",
    "./manifest.json",
    "./icon/icon.png",
    // Critical Game Engine Files (must match main.js scriptUrls)
    "./js/libs/pixi.js",
    "./js/libs/pako.min.js",
    "./js/libs/localforage.min.js",
    "./js/libs/effekseer.min.js",
    "./js/libs/vorbisdecoder.js",
    "./js/rmmz_core.js",
    "./js/rmmz_managers.js",
    "./js/rmmz_objects.js",
    "./js/rmmz_scenes.js",
    "./js/rmmz_sprites.js",
    "./js/rmmz_windows.js",
    "./js/plugins.js",
    "./js/libs/effekseer.wasm",
  ];

  // Helper to generate a visual progress bar
  function progressBar(current, total, width = 20) {
    const percent = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    return `[${current}/${total}] ${bar} ${percent}%`;
  }

  // Precache with progress logging
  event.waitUntil(
    caches.open("game-core").then(async (cache) => {
      const total = PRECACHE_ASSETS.length;
      let cached = 0;
      let failed = 0;

      console.log(`\n🎮 SW: Starting precache of ${total} assets...\n`);

      for (const url of PRECACHE_ASSETS) {
        try {
          await cache.add(url);
          cached++;
          console.log(`✅ ${progressBar(cached, total)} - ${url}`);
        } catch (err) {
          failed++;
          console.error(
            `❌ ${progressBar(cached, total)} - FAILED: ${url}`,
            err.message
          );
        }
      }

      console.log(`\n🏁 SW: Precache complete!`);
      console.log(`   ✅ Cached: ${cached}/${total}`);
      if (failed > 0) {
        console.warn(`   ❌ Failed: ${failed}/${total}`);
      }
      console.log(``);
    })
  );
});
