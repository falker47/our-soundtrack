importScripts("./soundtrack-catalog.js");

const APP_CACHE_NAME = "our-soundtrack-app-v5";
const MEDIA_CACHE_NAME = "our-soundtrack-media-v1";

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

  const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
  if (!match) return cachedResponse;

  const body = await cachedResponse.arrayBuffer();
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : body.byteLength - 1;
  const end = Math.min(requestedEnd, body.byteLength - 1);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start > end ||
    start >= body.byteLength
  ) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${body.byteLength}` },
    });
  }

  const headers = new Headers(cachedResponse.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${start}-${end}/${body.byteLength}`);
  headers.set("Content-Length", String(end - start + 1));

  return new Response(body.slice(start, end + 1), {
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
  let cachedResources = 0;
  let completeTracks = 0;

  for (const track of MEDIA_BY_TRACK) {
    const matches = await Promise.all(track.urls.map((url) => cache.match(url)));
    const trackCached = matches.every(Boolean);
    cachedResources += matches.filter(Boolean).length;
    if (trackCached) completeTracks += 1;
  }

  return {
    completeTracks,
    totalTracks: MEDIA_BY_TRACK.length,
    cachedResources,
    totalResources: MEDIA_URLS.length,
    complete: completeTracks === MEDIA_BY_TRACK.length,
  };
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
