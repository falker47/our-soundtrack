import test from "node:test";
import assert from "node:assert/strict";

await import("../offline-client.js");

const offline = globalThis.SoundtrackOffline;

test("offline state is idle when no media resource is cached", () => {
  assert.deepEqual(offline.deriveOfflineState({}, 80), {
    mode: "idle",
    progress: 0,
    complete: false,
  });
});

test("offline state exposes resumable partial progress", () => {
  assert.deepEqual(
    offline.deriveOfflineState(
      { cachedResources: 20, totalResources: 80, complete: false },
      80
    ),
    {
      mode: "partial",
      progress: 0.25,
      complete: false,
    }
  );
});

test("complete offline state always renders as ready", () => {
  assert.deepEqual(
    offline.deriveOfflineState(
      { cachedResources: 80, totalResources: 80, complete: true },
      80
    ),
    {
      mode: "ready",
      progress: 1,
      complete: true,
    }
  );
});

test("completion progress prefers exact resource counts and falls back to tracks", () => {
  assert.equal(
    offline.completionProgress({
      cachedResources: 40,
      totalResources: 80,
      completeTracks: 20,
      totalTracks: 20,
    }),
    0.5
  );

  assert.equal(
    offline.completionProgress({
      completeTracks: 5,
      totalTracks: 20,
    }),
    0.25
  );
});
