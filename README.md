# Our Soundtrack 💕

A personal web music player created as a romantic gift, built around a curated **20-track soundtrack** with album art, lyrics, background video and three cover recordings sung by Mauri.

> _Every note is a piece of us._

## Features

- **20-track canonical catalog** shared by the player and PWA logic.
- **Audio player** with play/pause, next, previous, shuffle, repeat and drag-to-seek.
- **Visual experience** with track-specific artwork and video backgrounds.
- **Lyrics** loaded alongside the selected track.
- **Responsive mobile UI** with a collapsible playlist drawer.
- **Installable PWA** scoped correctly for GitHub Pages project hosting.
- **Opt-in offline library**: the app shell is cached automatically, while the full media catalog is downloaded only on request.
- **Resumable offline download** with compact progress/completion state and removal from the device.
- **Offline seeking** for fully cached audio/video through byte-range responses.

## Architecture

The catalog is the single source of truth:

```text
soundtrack-catalog.js
├── player-core.js ──> script.js ──> DOM + media elements
└── service-worker.js ──> offline media cache
                           ↑
                    offline-client.js
```

The main responsibilities are intentionally separated:

- `soundtrack-catalog.js` — canonical 20-track asset map.
- `player-core.js` — pure playback decisions such as navigation, shuffle/repeat behavior and stale-load generation guards.
- `script.js` — browser orchestration for the current track, media elements, playlist UI, seeking and lyrics.
- `offline-client.js` — Service Worker registration, download-state protocol and compact offline control.
- `service-worker-core.js` — directly testable byte-range and offline-cache summary logic.
- `service-worker.js` — app-shell caching, runtime media caching, explicit full-library download, resume/removal and request routing.
- `scripts/validate-catalog.mjs` — structural guardrails for catalog assets, PWA scope and the approved offline UX.
- `tests/` — focused zero-dependency behavior tests using Node's built-in test runner.

A monotonic load guard prevents slow cover/video/lyrics work from an older track selection from overwriting the most recently selected track.

## Offline model

The PWA deliberately does **not** preload the full media library.

1. The Service Worker installs the small application shell.
2. Media requested during normal playback may be cached on demand.
3. The user can explicitly download the complete 20-track library (currently about 123 MiB).
4. Partial downloads are detected from the media cache and can be resumed.
5. Fully cached media supports byte-range responses so seeking continues to work offline.
6. The completed-download control can remove the local media cache again.

## Development

The project has no runtime build step and no test-framework dependency. Serve the repository through a local HTTP server rather than opening `index.html` directly so PWA and fetch behavior match deployment.

Run the same checks used by CI:

```bash
node --check soundtrack-catalog.js
node --check player-core.js
node --check offline-client.js
node --check script.js
node --check service-worker-core.js
node --check service-worker.js
node --test tests/*.test.mjs
node scripts/validate-catalog.mjs
node scripts/validate-media-distribution.mjs
```

CI verifies the canonical media quartets, the three personal covers, playback decision logic, offline UI state derivation, stale-load invalidation, byte-range behavior, cache-status summaries, GitHub Pages scope-relative paths, and the bounded same-origin media distribution policy.

## Media layout

Each catalog entry points explicitly to four assets:

```text
music/<track>.mp3
images/cover/<track>.(jpg|png)
videos/<track>.mp4
lyrics/<track>.txt
```

Asset paths are declared by `soundtrack-catalog.js`; the player and Service Worker do not maintain separate playlists.


## Media distribution policy

The media library intentionally remains **co-located with the static app and served from the same GitHub Pages origin**.

That is a deliberate reliability choice rather than an unfinished migration:

- the current canonical media footprint is about 123 MiB, comfortably below GitHub Pages' current 1 GB published-site limit and the recommended 1 GB source-repository limit;
- Git LFS is not used because GitHub Pages does not support LFS-backed site files;
- keeping media same-origin preserves the already validated Service Worker cache path and offline byte-range seeking without adding an external CDN/storage dependency;
- splitting media to another host would introduce CORS/range/availability assumptions without solving a current capacity problem.

Repository/CI guardrails keep that decision bounded:

- only the 80 assets referenced by the 20-track canonical catalog may live in `music/`, `images/cover/`, `videos/` and `lyrics/`;
- orphaned or missing catalog media fail CI;
- Git LFS pointer files fail CI;
- no individual canonical media file may exceed 95 MiB;
- the total canonical media budget is capped at 200 MiB, so meaningful growth forces an explicit distribution decision instead of silently bloating the site.

Binary assets are marked as binary in `.gitattributes` to avoid meaningless text diffs.

## Technologies

- HTML5 / CSS3
- Vanilla JavaScript
- Web Audio/Media APIs
- Service Worker + Cache Storage
- Web App Manifest
- Node 24 built-in test runner
- GitHub Actions
