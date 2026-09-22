importScripts("./soundtrack-catalog.js", "./service-worker-core.js");

const serviceWorkerCore = globalThis.SoundtrackServiceWorkerCore;
if (!serviceWorkerCore) {
  throw new Error("Soundtrack Service Worker core non disponibile.");
}

const { parseRangeHeader, summarizeOfflineMatches } = serviceWorkerCore;

const APP_CACHE_NAME = "our-soundtrack-app-v7";
const MEDIA_CACHE_NAME = "our-soundtrack-media-v1";

const APP_SHELL = [
  "./",
  "index.html",
  "style.css",
  "script.js",
  "player-core.js",
  "offline-client.js",
  "soundtrack-catalog.js",
  "service-worker-core.js",
  "manifest.json",
  "images/Album cover front.jpg",
  "images/Album cover retro.jpg",
  "images/favicon.png",
];

function scopedUrl(path) {
  return new URL(path, self.registration.scope).href;
}

const MEDIA_BY_TRACK = globalThis.SOUNDTRACK_CATALOG.map((track) => ({
  file: track.file,
  urls: [track.audio, track.cover, track.video, track.lyrics].map(scopedUrl),
}));

const MEDIA_URLS = MEDIA_BY_TRACK.flatMap((track) => track.urls);
const MEDIA_URL_SET = new Set(MEDIA_URLS);

async function cacheAppShell() {
  const cache = await caches.open(APP_CACHE_NAME);
  await Promise.all(
    APP_SHELL.map((resource) => cache.add(scopedUrl(resource)))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith("our-soundtrack-") &&
                cacheName !== APP_CACHE_NAME &&
                cacheName !== MEDIA_CACHE_NAME
            )
            .map((cacheName) => caches.delete(cacheName))
        )
      ),
      self.clients.claim(),
    ])
  );
});

async function rangeResponse(request, cachedResponse) {
  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) return cachedResponse;

  const body = await cachedResponse.arrayBuffer();
  const parsedRange = parseRangeHeader(rangeHeader, body.byteLength);

  if (!parsedRange) return cachedResponse;

  if (!parsedRange.valid) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${parsedRange.total}` },
    });
  }

  const headers = new Headers(cachedResponse.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set(
    "Content-Range",
    `bytes ${parsedRange.start}-${parsedRange.end}/${parsedRange.total}`
  );
  headers.set("Content-Length", String(parsedRange.length));

  return new Response(body.slice(parsedRange.start, parsedRange.end + 1), {
    status: 206,
    statusText: "Partial Content",
    headers,
  });
}

async function handleMediaRequest(request) {
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const canonicalRequest = new Request(request.url, { method: "GET" });
  const cachedResponse = await cache.match(canonicalRequest);

  if (cachedResponse) {
    return rangeResponse(request, cachedResponse);
  }

  const response = await fetch(request);

  if (
    !request.headers.has("range") &&
    response &&
    response.status === 200 &&
    response.type === "basic"
  ) {
    await cache.put(canonicalRequest, response.clone());
  }

  return response;
}

async function handleNavigation(request) {
  const cache = await caches.open(APP_CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === "basic") {
      await cache.put(scopedUrl("index.html"), response.clone());
    }
    return response;
  } catch {
    return (
      (await cache.match(scopedUrl("index.html"))) ||
      new Response("App non disponibile offline", {
        status: 503,
        statusText: "Service Unavailable",
      })
    );
  }
}

async function handleAppShellRequest(request) {
  const cache = await caches.open(APP_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          cache.put(request, response.clone());
        }
      })
      .catch(() => undefined);
    return cachedResponse;
  }

  return fetch(request);
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(handleNavigation(event.request));
    return;
  }

  if (MEDIA_URL_SET.has(requestUrl.href)) {
    event.respondWith(handleMediaRequest(event.request));
    return;
  }

  const appShellUrls = new Set(APP_SHELL.map(scopedUrl));
  if (appShellUrls.has(requestUrl.href)) {
    event.respondWith(handleAppShellRequest(event.request));
  }
});

async function getOfflineStatus() {
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const trackMatches = [];

  for (const track of MEDIA_BY_TRACK) {
    const matches = await Promise.all(track.urls.map((url) => cache.match(url)));
    trackMatches.push(matches.map(Boolean));
  }

  return summarizeOfflineMatches(trackMatches);
}

function postToClient(client, payload) {
  if (client && typeof client.postMessage === "function") {
    client.postMessage(payload);
  }
}

async function cacheOfflineLibrary(client) {
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const errors = [];

  for (let index = 0; index < MEDIA_BY_TRACK.length; index += 1) {
    const track = MEDIA_BY_TRACK[index];

    for (const url of track.urls) {
      try {
        const existing = await cache.match(url);
        if (existing) continue;

        const response = await fetch(url, { cache: "no-store" });
        if (!response || response.status !== 200 || response.type !== "basic") {
          throw new Error(`HTTP ${response?.status || "?"}`);
        }

        await cache.put(url, response.clone());
      } catch (error) {
        errors.push({ file: track.file, url, message: error.message });
      }
    }

    postToClient(client, {
      type: "OFFLINE_PROGRESS",
      completedTracks: index + 1,
      totalTracks: MEDIA_BY_TRACK.length,
      file: track.file,
    });
  }

  const status = await getOfflineStatus();
  postToClient(client, {
    type: "OFFLINE_COMPLETE",
    ...status,
    errors: errors.length,
  });
}

async function removeOfflineLibrary(client) {
  await caches.delete(MEDIA_CACHE_NAME);
  const status = await getOfflineStatus();
  postToClient(client, { type: "OFFLINE_REMOVED", ...status });
}

self.addEventListener("message", (event) => {
  const type = event.data?.type;

  if (type === "GET_OFFLINE_STATUS") {
    event.waitUntil(
      getOfflineStatus().then((status) =>
        postToClient(event.source, { type: "OFFLINE_STATUS", ...status })
      )
    );
    return;
  }

  if (type === "CACHE_OFFLINE_LIBRARY") {
    event.waitUntil(cacheOfflineLibrary(event.source));
    return;
  }

  if (type === "REMOVE_OFFLINE_LIBRARY") {
    event.waitUntil(removeOfflineLibrary(event.source));
  }
});
