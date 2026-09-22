import test from "node:test";
import assert from "node:assert/strict";

await import("../soundtrack-catalog.js");
await import("../player-core.js");

const core = globalThis.SoundtrackPlayerCore;
const catalog = globalThis.SOUNDTRACK_CATALOG;

test("canonical catalog maps to the 20 player tracks without changing asset paths", () => {
  const tracks = core.createTracks(catalog);

  assert.equal(tracks.length, 20);
  assert.deepEqual(
    tracks.map((track) => [track.file, track.cover, track.canvas, track.lyrics]),
    catalog.map((track) => [
      track.audio,
      track.cover,
      track.video,
      track.lyrics,
    ])
  );
});

test("filename parsing preserves titles that contain additional separators", () => {
  assert.deepEqual(core.parseFileName("Artist - Song - Live.mp3"), {
    artist: "Artist",
    title: "Song - Live",
  });

  assert.deepEqual(core.parseFileName("Standalone.mp3"), {
    artist: "",
    title: "Standalone",
  });
});

test("next and previous navigation wrap around the catalog", () => {
  assert.equal(core.nextTrackIndex(19, 20), 0);
  assert.equal(core.previousTrackIndex(0, 20), 19);
});

test("previous restarts after three seconds and changes track before that", () => {
  assert.deepEqual(
    core.resolvePreviousAction({
      currentIndex: 5,
      currentTime: 3.01,
      totalTracks: 20,
    }),
    { type: "restart", index: 5 }
  );

  assert.deepEqual(
    core.resolvePreviousAction({
      currentIndex: 0,
      currentTime: 3,
      totalTracks: 20,
    }),
    { type: "track", index: 19 }
  );
});

test("shuffle never returns the current track when alternatives exist", () => {
  const values = [0.5, 0.75];
  let offset = 0;
  const random = () => values[offset++];

  assert.equal(core.randomTrackIndex(10, 20, random), 15);
  assert.equal(offset, 2);
  assert.equal(core.randomTrackIndex(0, 1, () => 0), 0);
});

test("shuffle and repeat remain mutually exclusive", () => {
  assert.deepEqual(
    core.toggleExclusiveMode({ shuffle: false, repeat: true }, "shuffle"),
    { shuffle: true, repeat: false }
  );

  assert.deepEqual(
    core.toggleExclusiveMode({ shuffle: true, repeat: false }, "repeat"),
    { shuffle: false, repeat: true }
  );
});

test("ended behavior distinguishes repeat, shuffle and sequential playback", () => {
  assert.deepEqual(
    core.resolveEndedAction({
      currentIndex: 7,
      totalTracks: 20,
      repeat: true,
      shuffle: false,
    }),
    { type: "restart", index: 7 }
  );

  assert.deepEqual(
    core.resolveEndedAction({
      currentIndex: 19,
      totalTracks: 20,
      repeat: false,
      shuffle: false,
    }),
    { type: "track", index: 0 }
  );

  assert.deepEqual(
    core.resolveEndedAction({
      currentIndex: 3,
      totalTracks: 20,
      repeat: false,
      shuffle: true,
      random: () => 0.5,
    }),
    { type: "track", index: 10 }
  );
});

test("load guard invalidates stale asynchronous work", () => {
  const guard = core.createLoadGuard();
  const first = guard.next();
  assert.equal(guard.isCurrent(first), true);

  const second = guard.next();
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
});

test("time formatting keeps the current mm:ss behavior", () => {
  assert.equal(core.formatTime(0), "0:00");
  assert.equal(core.formatTime(65.9), "1:05");
  assert.equal(core.formatTime(Number.NaN), "0:00");
});
