import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

await import(path.join(root, "soundtrack-catalog.js"));

const catalog = globalThis.SOUNDTRACK_CATALOG;
if (!Array.isArray(catalog)) throw new Error("SOUNDTRACK_CATALOG was not initialized.");
if (catalog.length !== 20) throw new Error(`Expected 20 tracks, found ${catalog.length}.`);

const expectedCovers = new Set([
  "Mauri e Rita - Die With A Smile (cover).mp3",
  "Mauri - Eternity (cover).mp3",
  "Mauri - Grow Old with Me (cover).mp3",
]);

const seen = new Set();
for (const track of catalog) {
  if (seen.has(track.file)) throw new Error(`Duplicate track: ${track.file}`);
  seen.add(track.file);

  for (const key of ["audio", "cover", "video", "lyrics"]) {
    const filePath = path.join(root, track[key]);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing ${key} for ${track.file}: ${track[key]}`);
    }
  }
}

for (const file of expectedCovers) {
  if (!seen.has(file)) throw new Error(`Missing personal cover track: ${file}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
for (const value of [manifest.start_url, manifest.scope, ...manifest.icons.map((icon) => icon.src)]) {
  if (typeof value === "string" && value.startsWith("/")) {
    throw new Error(`Manifest path must be scope-relative for GitHub Pages: ${value}`);
  }
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const catalogPos = index.indexOf('src="soundtrack-catalog.js"');
const appPos = index.indexOf('src="script.js"');
if (catalogPos < 0 || appPos < 0 || catalogPos > appPos) {
  throw new Error("index.html must load soundtrack-catalog.js before script.js.");
}

const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
if (!serviceWorker.includes('importScripts("./soundtrack-catalog.js")')) {
  throw new Error("Service worker is not using the shared soundtrack catalog.");
}

console.log(`Catalog OK: ${catalog.length} tracks, with audio + cover + video + lyrics.`);
