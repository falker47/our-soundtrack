import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

await import(path.join(root, "soundtrack-catalog.js"));

const catalog = globalThis.SOUNDTRACK_CATALOG;
if (!Array.isArray(catalog)) throw new Error("SOUNDTRACK_CATALOG was not initialized.");
if (catalog.length !== 20) throw new Error(`Expected 20 tracks, found ${catalog.length}.`);

const personalCovers = new Set([
  "Mauri e Rita - Die With A Smile (cover).mp3",
  "Mauri - Eternity (cover).mp3",
  "Mauri - Grow Old with Me (cover).mp3",
]);

const rejectedTracks = [
  "Aerosmith - I Don't Want to Miss a Thing.mp3",
  "Queen - Love of My Life.mp3",
  "Lady Gaga - Die With A Smile.mp3",
  "Alex Warren - Eternity.mp3",
  "Tom Odell - Grow Old with Me.mp3",
];

const seen = new Set();
let mediaBytes = 0;

for (const track of catalog) {
  if (seen.has(track.file)) throw new Error(`Duplicate track: ${track.file}`);
  seen.add(track.file);

  for (const key of ["audio", "cover", "video", "lyrics"]) {
    const filePath = path.join(root, track[key]);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing ${key} for ${track.file}: ${track[key]}`);
    }
    mediaBytes += fs.statSync(filePath).size;
  }
}

for (const file of personalCovers) {
  if (!seen.has(file)) throw new Error(`Missing personal cover track: ${file}`);
}

for (const file of rejectedTracks) {
  if (seen.has(file)) throw new Error(`Discarded track returned to catalog: ${file}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
for (const value of [manifest.start_url, manifest.scope, ...manifest.icons.map((icon) => icon.src)]) {
  if (typeof value === "string" && value.startsWith("/")) {
    throw new Error(`Manifest path must be scope-relative for GitHub Pages: ${value}`);
  }
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const currentSources = [index, script, serviceWorker].join("\n");

const catalogPos = index.indexOf('src="soundtrack-catalog.js"');
const appPos = index.indexOf('src="script.js"');
if (catalogPos < 0 || appPos < 0 || catalogPos > appPos) {
  throw new Error("index.html must load soundtrack-catalog.js before script.js.");
}

for (const file of rejectedTracks) {
  if (currentSources.includes(file)) {
    throw new Error(`Discarded track still referenced by current app/PWA source: ${file}`);
  }
}

if (!serviceWorker.includes('importScripts("./soundtrack-catalog.js")')) {
  throw new Error("Service worker is not using the shared soundtrack catalog.");
}

if (!serviceWorker.includes('type === "CACHE_OFFLINE_LIBRARY"')) {
  throw new Error("Service worker is missing the explicit offline-download command.");
}

if (!serviceWorker.includes('type === "REMOVE_OFFLINE_LIBRARY"')) {
  throw new Error("Service worker is missing the offline-removal command.");
}

if (serviceWorker.includes("ALL_RESOURCES") || serviceWorker.includes("preloadAllResources")) {
  throw new Error("Service worker must not preload the full media library automatically.");
}

if (script.includes("preloadAllResources") || script.includes("preloadAudio(")) {
  throw new Error("Player must not preload the whole audio catalog automatically.");
}

for (const id of ["offlineDownloadBtn", "offlineRemoveBtn", "offlineStatus", "offlineProgress"]) {
  if (!index.includes(`id="${id}"`)) {
    throw new Error(`Missing offline UI control: ${id}`);
  }
}

if (currentSources.includes("images/cover.jpg")) {
  throw new Error("Stale missing images/cover.jpg fallback is still referenced.");
}

console.log(
  `Catalog OK: ${catalog.length} tracks, 4 assets each, ${(mediaBytes / 1024 / 1024).toFixed(1)} MiB total media.`
);
console.log("Offline policy OK: app shell automatic; full media library opt-in.");
