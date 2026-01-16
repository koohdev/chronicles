importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js"
);

if (workbox) {
  console.log(`🎮 Workbox is loaded`);

  // --- Configuration ---
  // Set to false in production for better performance
  const IS_DEBUG = true;
  workbox.setConfig({ debug: IS_DEBUG });

  // Take control of all clients immediately
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // --- Precaching (Critical Assets) ---
  // These are cached on install and available offline immediately.
  // The revision field enables cache-busting when files change.
  // For files with hashes in their names, revision can be null.
  const PRECACHE_MANIFEST = [
    { url: "./index.html", revision: "v1" },
    { url: "./css/game.css", revision: "v2" },
    { url: "./manifest.json", revision: "v1" },
    { url: "./icon/icon.png", revision: "v1" },
    // Critical Game Engine Files (must match main.js scriptUrls)
    { url: "./js/main.js", revision: "v2" },
    { url: "./js/libs/pixi.js", revision: "v1" },
    { url: "./js/libs/pako.min.js", revision: "v1" },
    { url: "./js/libs/localforage.min.js", revision: "v1" },
    { url: "./js/libs/effekseer.min.js", revision: "v1" },
    { url: "./js/libs/vorbisdecoder.js", revision: "v1" },
    { url: "./js/libs/effekseer.wasm", revision: "v1" },
    { url: "./js/rmmz_core.js", revision: "v1" },
    { url: "./js/rmmz_managers.js", revision: "v1" },
    { url: "./js/rmmz_objects.js", revision: "v1" },
    { url: "./js/rmmz_scenes.js", revision: "v1" },
    { url: "./js/rmmz_sprites.js", revision: "v1" },
    { url: "./js/rmmz_windows.js", revision: "v1" },
    { url: "./js/plugins.js", revision: "v1" },
  ];

  // Log precache list
  console.log(`📦 Precaching ${PRECACHE_MANIFEST.length} core assets...`);
  PRECACHE_MANIFEST.forEach((item, i) => {
    console.log(`   [${i + 1}/${PRECACHE_MANIFEST.length}] ${item.url}`);
  });

  // Use Workbox precaching (handles install, versioning, and cleanup)
  workbox.precaching.precacheAndRoute(PRECACHE_MANIFEST);

  // Clean up old precached versions
  workbox.precaching.cleanupOutdatedCaches();

  // --- Runtime Caching Strategies ---

  // 1. HTML, JS, CSS, JSON (Game Logic & Data) - StaleWhileRevalidate
  // Loads from cache first (fast), then updates cache in background.
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
      cacheName: "game-core-runtime",
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        }),
      ],
    })
  );

  // 2. Images, Audio, Fonts (Static Assets) - CacheFirst
  // These rarely change. Cached for 30 days.
  workbox.routing.registerRoute(
    ({ request, url }) => {
      return (
        request.destination === "image" ||
        request.destination === "audio" ||
        request.destination === "font" ||
        url.pathname.includes("/img/") ||
        url.pathname.includes("/audio/") ||
        url.pathname.includes("/fonts/") ||
        url.pathname.includes("/icon/") ||
        url.pathname.includes("/effects/")
      );
    },
    new workbox.strategies.CacheFirst({
      cacheName: "game-assets",
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 1000, // Games have many files
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
          purgeOnQuotaError: true, // Auto-cleanup if storage is full
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // 3. Data files (JSON game data) - NetworkFirst with cache fallback
  // Prefer fresh data but fall back to cache if offline
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.startsWith("/data/"),
    new workbox.strategies.NetworkFirst({
      cacheName: "game-data",
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        }),
      ],
    })
  );

  // --- Fallback Handlers ---

  // Default handler for any unmatched requests
  workbox.routing.setDefaultHandler(
    new workbox.strategies.NetworkFirst({
      cacheName: "default-cache",
    })
  );

  // Catch handler for failed requests (offline fallback)
  workbox.routing.setCatchHandler(async ({ event }) => {
    // For navigation requests, return the cached index.html
    if (event.request.destination === "document") {
      const cachedResponse = await caches.match("./index.html");
      if (cachedResponse) {
        console.log("📴 Offline: Serving cached index.html");
        return cachedResponse;
      }
    }

    // For images, could return a placeholder (optional)
    if (event.request.destination === "image") {
      console.warn("📴 Offline: Image not available:", event.request.url);
      // Return a placeholder or error response
      return Response.error();
    }

    // For other requests, return error
    console.warn("📴 Offline: Resource not available:", event.request.url);
    return Response.error();
  });

  console.log("✅ Service Worker configured successfully");
} else {
  console.error("❌ Workbox failed to load");
}
