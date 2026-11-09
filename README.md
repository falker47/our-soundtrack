# Our Soundtrack 💕

A personal web music player created as a romantic gift, built around a curated **20-track soundtrack** with album art, lyrics, background video and three cover recordings sung by Mauri.

> _Every note is a piece of us._

**Live site:** https://falker47.github.io/our-soundtrack/

## Features

- **20-track canonical catalog** shared by the player and PWA logic.
- **Audio player** with play/pause, next, previous, shuffle, repeat and drag-to-seek.
- **Visual experience** with track-specific artwork and video backgrounds.
- **Lyrics** loaded alongside the selected track.
- **Responsive mobile UI** with a collapsible playlist drawer.
- **Installable PWA** scoped for GitHub Pages project hosting, with a one-time install nudge after the first explicit offline download starts, where supported.
- **Opt-in offline library**: the app shell is cached automatically, while the full media catalog is downloaded only on request.
- **Resumable offline download** at the individual-file level, with progress/completion state and removal after completion.
- **Offline seeking** for fully cached audio/video through byte-range responses.

## Getting started

Open the [live site](https://falker47.github.io/our-soundtrack/) and select **Inizia ad ascoltare**.

Choose a song from the playlist or use the playback controls. Shuffle and repeat are mutually exclusive; repeat restarts the current song.

To prepare the complete library for offline use, select the download icon beside the playlist heading while connected to the Internet. The download is approximately 123 MiB, plus browser storage overhead.

Once the download is complete, the control displays a checkmark. Select it to remove the downloaded media after confirmation.

The site can be used without installing the PWA. Where supported, an installation suggestion appears after the first explicit offline download begins. On iPhone and iPad, installation is guided through the browser's **Add to Home Screen** option.

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
- `offline-client.js` — Service Worker registration, download-state protocol, compact offline control, Android/Chromium install prompt capture and iOS Home Screen guidance.
- `service-worker-core.js` — directly testable byte-range and offline-cache summary logic.
- `service-worker.js` — app-shell caching, runtime media caching, explicit full-library download, resume/removal and request routing.
- `scripts/validate-catalog.mjs` — structural guardrails for catalog assets, PWA scope and the approved offline UX.
- `tests/` — focused zero-dependency behavior tests using Node's built-in test runner.

A monotonic load guard prevents slow cover/video/lyrics work from an older track selection from overwriting the most recently selected track.

## Offline model

The PWA deliberately does **not** preload the full media library.

1. The Service Worker installs and caches the small application shell.
2. Media requested during normal playback may be cached on demand.
3. The user can explicitly download the complete 20-track library, currently about 123 MiB.
4. Interrupted downloads can resume by reusing fully cached resources. Individual files are not resumed from partial byte offsets.
5. Fully cached media supports byte-range responses so seeking can continue offline.
6. Once the library is complete, the download control can remove the local media cache again.

The download progress indicates tracks processed, not bytes transferred. A completed pass does not guarantee that every resource was saved: failed resources leave the library incomplete and can be retried.

The in-app removal control is available after full completion. To remove an incomplete download without resuming it, clear the site's stored data using the browser settings. This also removes other locally cached site data.

Offline availability depends on successful caching and browser storage retention. The browser may clear stored content because of storage pressure or user settings; a request for persistent storage does not guarantee that it will be granted.

## Browser compatibility

The online player uses standard browser media APIs. PWA installation, offline storage and background caching additionally require compatible browser functionality.

- Service Workers require a secure context such as HTTPS or `localhost`.
- Offline downloads depend on Service Worker and Cache Storage support, available storage quota and browser storage policies.
- The native installation prompt is used only when the browser exposes it. iOS devices receive Home Screen installation guidance instead.
- An initial online visit is required to install the Service Worker and prepare the application shell.

The automated tests validate JavaScript behavior and static asset constraints, not an exhaustive browser/device compatibility matrix. Installation, storage persistence, media playback and offline behavior should be tested on each target browser and device before relying on them.

## Development

The project has no runtime build step and no test-framework dependency.

Serve the repository through a local HTTP server rather than opening `index.html` directly so PWA and fetch behavior match deployment.

For example, with Python 3 installed, run the following command from the repository root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Node.js 24 is used in GitHub Actions. Run the same checks used by CI:

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

These automated checks do not replace real browser testing or a review of the rights to distribute media.

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

That is a deliberate technical reliability choice rather than an unfinished migration:

- the current canonical media footprint is about 123 MiB, below GitHub Pages' 1 GB published-site limit and recommended 1 GB source-repository limit;
- Git LFS is not used because GitHub Pages does not support LFS-backed site files;
- keeping media same-origin preserves the tested Service Worker cache path and offline byte-range handling without adding an external CDN/storage dependency;
- splitting media to another host would introduce CORS/range/availability assumptions without solving the current capacity problem.

Repository/CI guardrails keep that decision bounded:

- only the 80 assets referenced by the 20-track canonical catalog may live in `music/`, `images/cover/`, `videos/` and `lyrics/`;
- orphaned or missing catalog media fail CI;
- Git LFS pointer files fail CI;
- no individual canonical media file may exceed 95 MiB;
- the total canonical media budget is capped at 200 MiB, so meaningful growth forces an explicit distribution decision instead of silently bloating the site.

Binary assets are marked as binary in `.gitattributes` to avoid meaningless text diffs.

This section describes the technical hosting arrangement. It does not establish permission to publish or redistribute third-party material.

## Privacy and local storage

The application code does not implement user accounts, a backend database or application-specific analytics.

The player uses browser-local storage mechanisms:

- **Cache Storage** holds the application shell and downloaded media.
- **localStorage** records whether the one-time PWA installation suggestion has already been handled.
- The browser may retain additional ordinary HTTP cache data.

Removing the completed offline library clears its dedicated media cache, not every item associated with the website.

The site is hosted by GitHub Pages and loads the Outfit font through Google Fonts. Requests to these providers can expose ordinary connection metadata, including IP addresses, under their respective policies.

The absence of application-specific analytics does not mean that hosting or font providers process no request data.

## Copyright and licensing

This repository does not currently include a software license file. Its public availability does not make the source code open source or grant general permission to reproduce, modify or redistribute it.

The repository also includes audio recordings, videos, artwork and song lyrics. These materials may be subject to separate copyrights and related rights held by their respective owners.

Personal cover recordings may still incorporate protected musical compositions or lyrics, even when the recording itself was performed by the project's contributors.

**No permission to reuse or redistribute third-party media is granted by this README.** Public hosting, downloading, reproduction and redistribution must comply with the rights and authorizations applicable to the particular materials.

Any future decision to publish the code under an open-source license must distinguish the software from the music and other media. A software license alone cannot authorize use of third-party creative works.

## Technologies

- HTML5 / CSS3
- Vanilla JavaScript
- Web Audio/Media APIs
- Service Worker + Cache Storage
- Web App Manifest
- Node 24 built-in test runner
- GitHub Actions
