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


test("install nudge prefers the browser-native prompt when available", () => {
  assert.equal(
    offline.resolveInstallNudgeMode({
      standalone: false,
      ios: false,
      canPrompt: true,
      handled: false,
    }),
    "native"
  );
});

test("install nudge falls back to iOS Home Screen instructions", () => {
  assert.equal(
    offline.resolveInstallNudgeMode({
      standalone: false,
      ios: true,
      canPrompt: false,
      handled: false,
    }),
    "ios"
  );
  assert.equal(
    offline.resolveInstallNudgeMode({
      standalone: true,
      ios: true,
      canPrompt: false,
      handled: false,
    }),
    "hidden"
  );
  assert.equal(
    offline.resolveInstallNudgeMode({
      standalone: false,
      ios: true,
      canPrompt: false,
      handled: true,
    }),
    "hidden"
  );
});

test("iOS detection covers iPhone and iPadOS desktop-class user agents", () => {
  assert.equal(
    offline.isIosLike(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      "iPhone",
      5
    ),
    true
  );
  assert.equal(
    offline.isIosLike(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      "MacIntel",
      5
    ),
    true
  );
  assert.equal(
    offline.isIosLike(
      "Mozilla/5.0 (Linux; Android 16)",
      "Linux armv8l",
      5
    ),
    false
  );
});
