import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

await import(path.join(root, "soundtrack-catalog.js"));

const catalog = globalThis.SOUNDTRACK_CATALOG;
if (!Array.isArray(catalog) || catalog.length === 0) {
  throw new Error("SOUNDTRACK_CATALOG was not initialized.");
}

const MEDIA_ROOTS = ["music", "images/cover", "videos", "lyrics"];
const MAX_CANONICAL_MEDIA_BYTES = 200 * 1024 * 1024;
const MAX_SINGLE_MEDIA_FILE_BYTES = 95 * 1024 * 1024;
const LFS_POINTER_PREFIX = "version https://git-lfs.github.com/spec/v1";

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function walkFiles(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    throw new Error(`Missing media directory: ${relativeDir}`);
  }

  const files = [];
  const stack = [absoluteDir];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else if (entry.isFile()) {
        files.push(toPosix(path.relative(root, absolute)));
      }
    }
  }

  return files.sort();
}

const expectedByRoot = new Map(
  MEDIA_ROOTS.map((mediaRoot) => [mediaRoot, new Set()])
);

for (const track of catalog) {
  const paths = [track.audio, track.cover, track.video, track.lyrics];

  for (const assetPath of paths) {
    const rootKey = MEDIA_ROOTS.find(
      (mediaRoot) =>
        assetPath === mediaRoot || assetPath.startsWith(`${mediaRoot}/`)
    );

    if (!rootKey) {
      throw new Error(
        `Catalog asset is outside the approved media roots: ${assetPath}`
      );
    }

    expectedByRoot.get(rootKey).add(assetPath);
  }
}

let totalBytes = 0;
let largestAsset = { path: "", bytes: 0 };

for (const mediaRoot of MEDIA_ROOTS) {
  const actual = walkFiles(mediaRoot);
  const expected = expectedByRoot.get(mediaRoot);

  const unexpected = actual.filter((file) => !expected.has(file));
  const missing = [...expected].filter((file) => !actual.includes(file));

  if (unexpected.length > 0) {
    throw new Error(
      `Unreferenced media in ${mediaRoot}: ${unexpected.join(", ")}`
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Catalog media missing from ${mediaRoot}: ${missing.join(", ")}`
    );
  }

  for (const relativePath of actual) {
    const absolutePath = path.join(root, relativePath);
    const stat = fs.statSync(absolutePath);

    if (stat.size > MAX_SINGLE_MEDIA_FILE_BYTES) {
      throw new Error(
        `Media file exceeds the 95 MiB repository safety cap: ${relativePath} (${(
          stat.size /
          1024 /
          1024
        ).toFixed(1)} MiB)`
      );
    }

    const fd = fs.openSync(absolutePath, "r");
    const probe = Buffer.alloc(Math.min(128, stat.size));
    fs.readSync(fd, probe, 0, probe.length, 0);
    fs.closeSync(fd);

    if (probe.toString("utf8").startsWith(LFS_POINTER_PREFIX)) {
      throw new Error(
        `Git LFS pointer detected in Pages-served media: ${relativePath}`
      );
    }

    totalBytes += stat.size;
    if (stat.size > largestAsset.bytes) {
      largestAsset = { path: relativePath, bytes: stat.size };
    }
  }
}

if (totalBytes > MAX_CANONICAL_MEDIA_BYTES) {
  throw new Error(
    `Canonical media footprint is ${(totalBytes / 1024 / 1024).toFixed(
      1
    )} MiB, above the 200 MiB distribution budget.`
  );
}

const expectedAssetCount = catalog.length * 4;
const actualAssetCount = [...expectedByRoot.values()].reduce(
  (sum, set) => sum + set.size,
  0
);

if (actualAssetCount !== expectedAssetCount) {
  throw new Error(
    `Expected ${expectedAssetCount} unique canonical media assets, found ${actualAssetCount}.`
  );
}

console.log(
  `Media distribution OK: ${actualAssetCount} canonical assets, ${(
    totalBytes /
    1024 /
    1024
  ).toFixed(1)} MiB total.`
);
console.log(
  `Largest canonical asset: ${largestAsset.path} (${(
    largestAsset.bytes /
    1024 /
    1024
  ).toFixed(1)} MiB).`
);
console.log(
  "Distribution policy OK: same-origin GitHub Pages media, no LFS pointers, no orphaned catalog media."
);
