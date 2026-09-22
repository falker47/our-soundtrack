importScripts("./soundtrack-catalog.js");

const CACHE_NAME = "our-soundtrack-v2";
const APP_SHELL = [
  "./",
  "index.html",
  "style.css",
  "script.js",
  "soundtrack-catalog.js",
  "manifest.json",
  "images/Album cover front.jpg",
  "images/Album cover retro.jpg",
  "images/favicon.png",
];

const MEDIA_RESOURCES = globalThis.SOUNDTRACK_CATALOG.flatMap((track) => [
  track.audio,
  track.cover,
  track.video,
  track.lyrics,
]);

const ALL_RESOURCES = [...APP_SHELL, ...MEDIA_RESOURCES];
const INSTALL_RESOURCES = [
  ...APP_SHELL,
  ...globalThis.SOUNDTRACK_CATALOG.map((track) => track.audio),
];

function scopedUrl(path) {
  return new URL(path, self.registration.scope).href;
}

async function cacheResources(cache, resources) {
  await Promise.allSettled(
    resources.map(async (resource) => {
      try {
        await cache.add(scopedUrl(resource));
      } catch (error) {
        console.warn("[Service Worker] Cache miss during preload:", resource, error);
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cacheResources(cache, INSTALL_RESOURCES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      ),
      self.clients.claim(),
      caches
        .open(CACHE_NAME)
        .then((cache) => cacheResources(cache, ALL_RESOURCES)),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        event.waitUntil(
          fetch(event.request)
            .then((networkResponse) => {
              if (
                networkResponse &&
                networkResponse.status === 200 &&
                networkResponse.type === "basic"
              ) {
                return caches
                  .open(CACHE_NAME)
                  .then((cache) => cache.put(event.request, networkResponse.clone()));
              }
            })
            .catch(() => undefined)
        );
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === "basic"
          ) {
            const copy = networkResponse.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
            );
          }
          return networkResponse;
        })
        .catch(async () => {
          if (event.request.mode === "navigate") {
            return (
              (await caches.match(scopedUrl("index.html"))) ||
              new Response("App non disponibile offline", {
                status: 503,
                statusText: "Service Unavailable",
              })
            );
          }

          if (event.request.destination === "image") {
            return (
              (await caches.match(scopedUrl("images/Album cover front.jpg"))) ||
              new Response("", { status: 503 })
            );
          }

          return new Response("Risorsa non disponibile offline", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
    })
  );
});
