importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js"
);

if (workbox) {
  console.log(`🎮 Workbox is loaded`);

  // --- Configuration ---
  const IS_DEBUG = true;
  workbox.setConfig({ debug: IS_DEBUG });

  // Take control immediately
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // --- COMPLETE Precache List ---
  // All files needed for offline play
  const PRECACHE_MANIFEST = [
    // HTML & Manifest
    { url: "./index.html", revision: "v8" },
    { url: "./manifest.json", revision: "v1" },
    { url: "./icon/icon.png", revision: "v1" },

    // CSS Files
    { url: "./css/game.css", revision: "v2" },
    { url: "./css/anet.css", revision: "v1" },
    { url: "./css/anet_chat.css", revision: "v1" },

    // Core Engine (libs)
    { url: "./js/libs/pixi.js", revision: "v1" },
    { url: "./js/libs/pako.min.js", revision: "v1" },
    { url: "./js/libs/localforage.min.js", revision: "v1" },
    { url: "./js/libs/effekseer.min.js", revision: "v1" },
    { url: "./js/libs/vorbisdecoder.js", revision: "v1" },
    { url: "./js/libs/effekseer.wasm", revision: "v1" },

    // Core Engine (runtime)
    { url: "./js/main.js", revision: "v5" },
    { url: "./js/rmmz_core.js", revision: "v3" },
    { url: "./js/rmmz_managers.js", revision: "v1" },
    { url: "./js/rmmz_objects.js", revision: "v1" },
    { url: "./js/rmmz_scenes.js", revision: "v1" },
    { url: "./js/rmmz_sprites.js", revision: "v1" },
    { url: "./js/rmmz_windows.js", revision: "v1" },
    { url: "./js/plugins.js", revision: "v1" },

    // ALL Plugins (every .js file in plugins folder)
    { url: "./js/plugins/Alpha_NETZ.js", revision: "v1" },
    { url: "./js/plugins/AltMenuScreen.js", revision: "v1" },
    { url: "./js/plugins/AltSaveScreen.js", revision: "v1" },
    { url: "./js/plugins/ButtonPicture.js", revision: "v1" },
    { url: "./js/plugins/COCOMODE_enemyLevels.js", revision: "v1" },
    { url: "./js/plugins/MathBattleSystem_MZ.js", revision: "v1" },
    { url: "./js/plugins/ProceduralQuestSystem.js", revision: "v1" },
    { url: "./js/plugins/SimpleP2P_Evolution.js", revision: "v1" },
    { url: "./js/plugins/SimpleP2P_Refined_v2.js", revision: "v1" },
    { url: "./js/plugins/SimpleQuestLog.js", revision: "v1" },
    { url: "./js/plugins/TextPicture.js", revision: "v1" },

    // ALL Data Files
    { url: "./data/Actors.json", revision: "v1" },
    { url: "./data/Animations.json", revision: "v1" },
    { url: "./data/Armors.json", revision: "v1" },
    { url: "./data/Classes.json", revision: "v1" },
    { url: "./data/CommonEvents.json", revision: "v1" },
    { url: "./data/Enemies.json", revision: "v1" },
    { url: "./data/Items.json", revision: "v1" },
    { url: "./data/Map001.json", revision: "v1" },
    { url: "./data/Map002.json", revision: "v1" },
    { url: "./data/Map003.json", revision: "v1" },
    { url: "./data/Map004.json", revision: "v1" },
    { url: "./data/MapInfos.json", revision: "v1" },
    { url: "./data/Skills.json", revision: "v1" },
    { url: "./data/States.json", revision: "v1" },
    { url: "./data/System.json", revision: "v1" },
    { url: "./data/Tilesets.json", revision: "v1" },
    { url: "./data/Troops.json", revision: "v1" },
    { url: "./data/Weapons.json", revision: "v1" },
  ];

  console.log(`📦 Precaching ${PRECACHE_MANIFEST.length} files...`);

  // Use Workbox precaching
  workbox.precaching.precacheAndRoute(PRECACHE_MANIFEST);
  workbox.precaching.cleanupOutdatedCaches();

  // --- Runtime Caching for Images, Audio, Effects ---
  // These will be cached when first accessed

  // Images - CacheFirst (long-lived)
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.includes("/img/"),
    new workbox.strategies.CacheFirst({
      cacheName: "game-images",
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 500,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // Audio - CacheFirst
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.includes("/audio/"),
    new workbox.strategies.CacheFirst({
      cacheName: "game-audio",
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 500,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // Effects - CacheFirst
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.includes("/effects/"),
    new workbox.strategies.CacheFirst({
      cacheName: "game-effects",
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // Fonts
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.includes("/fonts/"),
    new workbox.strategies.CacheFirst({
      cacheName: "game-fonts",
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // Default handler - NetworkFirst
  workbox.routing.setDefaultHandler(
    new workbox.strategies.NetworkFirst({
      cacheName: "default-cache",
    })
  );

  // Catch handler for offline
  workbox.routing.setCatchHandler(async ({ event }) => {
    if (event.request.destination === "document") {
      return caches.match("./index.html");
    }
    return Response.error();
  });

  console.log("✅ Service Worker ready");
} else {
  console.error("❌ Workbox failed to load");
}
