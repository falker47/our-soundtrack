import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

await import(path.join(root, "soundtrack-catalog.js"));

const catalog = globalThis.SOUNDTRACK_CATALOG;
if (!Array.isArray(catalog)) {
  throw new Error("SOUNDTRACK_CATALOG was not initialized.");
}
if (catalog.length !== 20) {
  throw new Error(`Expected 20 tracks, found ${catalog.length}.`);
}

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
  if (seen.has(track.file)) {
    throw new Error(`Duplicate track: ${track.file}`);
  }
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
  if (!seen.has(file)) {
    throw new Error(`Missing personal cover track: ${file}`);
  }
}

for (const file of rejectedTracks) {
  if (seen.has(file)) {
    throw new Error(`Discarded track returned to catalog: ${file}`);
  }
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.json"), "utf8")
);
for (const value of [
  manifest.start_url,
  manifest.scope,
  ...manifest.icons.map((icon) => icon.src),
]) {
  if (typeof value === "string" && value.startsWith("/")) {
    throw new Error(
      `Manifest path must be scope-relative for GitHub Pages: ${value}`
    );
  }
}

const iconSizes = new Set(
  manifest.icons.flatMap((icon) => String(icon.sizes || "").split(/\s+/).filter(Boolean))
);
for (const requiredSize of ["192x192", "512x512"]) {
  if (!iconSizes.has(requiredSize)) {
    throw new Error(`Manifest is missing the required Chromium install icon size: ${requiredSize}`);
  }
}
for (const icon of manifest.icons) {
  const iconPath = path.join(root, icon.src);
  if (!fs.existsSync(iconPath)) {
    throw new Error(`Manifest icon does not exist: ${icon.src}`);
  }
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
const playerCore = fs.readFileSync(path.join(root, "player-core.js"), "utf8");
const offlineClient = fs.readFileSync(
  path.join(root, "offline-client.js"),
  "utf8"
);
const styles = fs.readFileSync(path.join(root, "style.css"), "utf8");
const serviceWorker = fs.readFileSync(
  path.join(root, "service-worker.js"),
  "utf8"
);
const serviceWorkerCore = fs.readFileSync(
  path.join(root, "service-worker-core.js"),
  "utf8"
);

const currentSources = [
  index,
  script,
  playerCore,
  offlineClient,
  styles,
  serviceWorker,
  serviceWorkerCore,
].join("\n");

if (!index.startsWith("<!DOCTYPE html>")) {
  throw new Error(
    "index.html must begin with <!DOCTYPE html> and contain no stray markup before it."
  );
}

for (const id of [
  "offlineDownloadControl",
  "offlineProgressRing",
  "offlinePercent",
  "offlineDownloadGlyph",
  "offlineCheckGlyph",
  "installNudge",
  "installNudgeText",
  "installNudgeLater",
  "installNudgeAction",
]) {
  const occurrences = index.split(`id="${id}"`).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected exactly one ${id}, found ${occurrences}.`);
  }
}

const scriptOrder = [
  'src="soundtrack-catalog.js"',
  'src="player-core.js"',
  'src="offline-client.js"',
  'src="script.js"',
].map((needle) => index.indexOf(needle));

if (
  scriptOrder.some((position) => position < 0) ||
  scriptOrder.some((position, index) =>
    index === 0 ? false : position <= scriptOrder[index - 1]
  )
) {
  throw new Error(
    "index.html must load catalog, player core, offline client and browser controller in that order."
  );
}

for (const file of rejectedTracks) {
  if (currentSources.includes(file)) {
    throw new Error(
      `Discarded track still referenced by current app/PWA source: ${file}`
    );
  }
}

if (
  !serviceWorker.includes(
    'importScripts("./soundtrack-catalog.js", "./service-worker-core.js")'
  )
) {
  throw new Error(
    "Service worker must use the canonical catalog and its tested core helpers."
  );
}

for (const appShellModule of [
  '"player-core.js"',
  '"offline-client.js"',
  '"service-worker-core.js"',
]) {
  if (!serviceWorker.includes(appShellModule)) {
    throw new Error(`App shell is missing ${appShellModule}.`);
  }
}

if (!script.includes("globalThis.SoundtrackPlayerCore")) {
  throw new Error("Browser controller is not using the player core.");
}

if (!script.includes("createLoadGuard")) {
  throw new Error(
    "Browser controller is missing stale asynchronous-load protection."
  );
}

if (!script.includes("globalThis.SoundtrackOffline.init()")) {
  throw new Error("Browser controller is not delegating offline setup.");
}

if (script.includes("CACHE_OFFLINE_LIBRARY")) {
  throw new Error(
    "Offline Service Worker protocol leaked back into the player controller."
  );
}

if (!serviceWorker.includes('type === "CACHE_OFFLINE_LIBRARY"')) {
  throw new Error(
    "Service worker is missing the explicit offline-download command."
  );
}

if (!serviceWorker.includes('type === "REMOVE_OFFLINE_LIBRARY"')) {
  throw new Error("Service worker is missing the offline-removal command.");
}

if (
  serviceWorker.includes("ALL_RESOURCES") ||
  serviceWorker.includes("preloadAllResources")
) {
  throw new Error(
    "Service worker must not preload the full media library automatically."
  );
}

if (script.includes("preloadAllResources") || script.includes("preloadAudio(")) {
  throw new Error("Player must not preload the whole audio catalog automatically.");
}

for (const removedId of [
  "offlineModal",
  "offlineOpenBtn",
  "offlineDownloadBtn",
  "offlineRemoveBtn",
  "offlineStatus",
  "offlineProgress",
]) {
  if (index.includes(`id="${removedId}"`)) {
    throw new Error(`Obsolete offline panel UI is still present: ${removedId}`);
  }
}

if (index.includes("Ascolta senza Internet")) {
  throw new Error("Obsolete offline explanatory panel copy is still present.");
}

if (!offlineClient.includes('setOfflineControlState("downloading"')) {
  throw new Error("Download icon is missing its progress state.");
}

if (!offlineClient.includes('setOfflineControlState("ready"')) {
  throw new Error("Download icon is missing its completed state.");
}

if (
  !styles.includes(".offline-progress-ring") ||
  !styles.includes("@keyframes offline-ring-spin")
) {
  throw new Error("Animated circular download progress styling is missing.");
}

if (!offlineClient.includes("offlinePercent.textContent")) {
  throw new Error(
    "Download progress percentage is not rendered inside the icon."
  );
}

if (
  !offlineClient.includes('"beforeinstallprompt"') ||
  !offlineClient.includes('"appinstalled"') ||
  !offlineClient.includes("resolveInstallNudgeMode")
) {
  throw new Error("Cross-platform PWA install nudge wiring is missing.");
}

if (!styles.includes(".install-nudge") || !styles.includes(".install-nudge-button")) {
  throw new Error("Install nudge styling is missing.");
}

if (!index.includes('rel="apple-touch-icon"')) {
  throw new Error("iOS Home Screen icon metadata is missing.");
}

if (!serviceWorker.includes('"images/pwa-icon-192.svg"')) {
  throw new Error("App shell is missing the 192px install icon.");
}

if (!styles.includes("left: 20px;") || !styles.includes("right: auto;")) {
  throw new Error("Mobile hamburger must be anchored on the left.");
}

if (
  !styles.includes(".offline-download-control.ready .offline-progress-ring") ||
  !styles.includes("scale(0.68)")
) {
  throw new Error("Completed-download badge ring must remain compact.");
}

if (
  !index.includes('class="offline-check-glyph hidden"') ||
  !index.includes('stroke-linecap="round"')
) {
  throw new Error(
    "Completed-download state must use the classic stroked checkmark."
  );
}

if (!styles.includes("color: #86a18d;")) {
  throw new Error("Completed-download state must use the muted success color.");
}

if (currentSources.includes("images/cover.jpg")) {
  throw new Error("Stale missing images/cover.jpg fallback is still referenced.");
}

if (!playerCore.includes("resolveEndedAction")) {
  throw new Error("Player behavior core is missing ended-track resolution.");
}

if (!serviceWorkerCore.includes("parseRangeHeader")) {
  throw new Error("Service Worker core is missing byte-range parsing.");
}

console.log(
  `Catalog OK: ${catalog.length} tracks, 4 assets each, ${(
    mediaBytes /
    1024 /
    1024
  ).toFixed(1)} MiB total media.`
);
console.log(
  "Architecture OK: canonical catalog -> tested player/offline/SW modules."
);
console.log("Offline policy OK: app shell automatic; full media library opt-in.");
