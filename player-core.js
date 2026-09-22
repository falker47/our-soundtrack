(() => {
  function parseFileName(fileName) {
    const nameWithoutExt = fileName.replace(/\.mp3$/i, "");
    const parts = nameWithoutExt.split(" - ");

    if (parts.length >= 2) {
      return {
        artist: parts[0].trim(),
        title: parts.slice(1).join(" - ").trim(),
      };
    }

    return {
      artist: "",
      title: nameWithoutExt.trim(),
    };
  }

  function createTracks(catalogAssets) {
    if (!Array.isArray(catalogAssets)) {
      throw new TypeError("Expected a soundtrack catalog array.");
    }

    return catalogAssets.map((asset) => {
      const parsed = parseFileName(asset.file);
      const trackTitle =
        parsed.artist && parsed.title
          ? `${parsed.artist} - ${parsed.title}`
          : parsed.title || asset.file;

      return Object.freeze({
        title: trackTitle,
        artist: parsed.artist || "",
        songTitle: parsed.title || asset.file,
        file: asset.audio,
        cover: asset.cover,
        canvas: asset.video,
        lyrics: asset.lyrics,
      });
    });
  }

  function nextTrackIndex(currentIndex, totalTracks) {
    if (totalTracks <= 0) return -1;
    return (currentIndex + 1) % totalTracks;
  }

  function previousTrackIndex(currentIndex, totalTracks) {
    if (totalTracks <= 0) return -1;
    return (currentIndex - 1 + totalTracks) % totalTracks;
  }

  function randomTrackIndex(currentIndex, totalTracks, random = Math.random) {
    if (totalTracks <= 0) return -1;
    if (totalTracks === 1) return 0;

    let candidate = currentIndex;
    while (candidate === currentIndex) {
      candidate = Math.floor(random() * totalTracks);
    }
    return candidate;
  }

  function resolveNextIndex({
    currentIndex,
    totalTracks,
    shuffle = false,
    random = Math.random,
  }) {
    return shuffle
      ? randomTrackIndex(currentIndex, totalTracks, random)
      : nextTrackIndex(currentIndex, totalTracks);
  }

  function resolvePreviousAction({
    currentIndex,
    currentTime,
    totalTracks,
    shuffle = false,
    random = Math.random,
  }) {
    if (currentTime > 3) {
      return Object.freeze({ type: "restart", index: currentIndex });
    }

    return Object.freeze({
      type: "track",
      index: shuffle
        ? randomTrackIndex(currentIndex, totalTracks, random)
        : previousTrackIndex(currentIndex, totalTracks),
    });
  }

  function toggleExclusiveMode(state, target) {
    const next = {
      shuffle: Boolean(state?.shuffle),
      repeat: Boolean(state?.repeat),
    };

    if (target === "shuffle") {
      next.shuffle = !next.shuffle;
      if (next.shuffle) next.repeat = false;
      return Object.freeze(next);
    }

    if (target === "repeat") {
      next.repeat = !next.repeat;
      if (next.repeat) next.shuffle = false;
      return Object.freeze(next);
    }

    throw new Error(`Unknown playback mode: ${target}`);
  }

  function resolveEndedAction({
    currentIndex,
    totalTracks,
    shuffle = false,
    repeat = false,
    random = Math.random,
  }) {
    if (repeat) {
      return Object.freeze({ type: "restart", index: currentIndex });
    }

    return Object.freeze({
      type: "track",
      index: resolveNextIndex({
        currentIndex,
        totalTracks,
        shuffle,
        random,
      }),
    });
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function createLoadGuard() {
    let generation = 0;

    return Object.freeze({
      next() {
        generation += 1;
        return generation;
      },
      isCurrent(token) {
        return token === generation;
      },
    });
  }

  globalThis.SoundtrackPlayerCore = Object.freeze({
    parseFileName,
    createTracks,
    nextTrackIndex,
    previousTrackIndex,
    randomTrackIndex,
    resolveNextIndex,
    resolvePreviousAction,
    toggleExclusiveMode,
    resolveEndedAction,
    formatTime,
    createLoadGuard,
  });
})();
