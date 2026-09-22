import test from "node:test";
import assert from "node:assert/strict";

await import("../service-worker-core.js");

const core = globalThis.SoundtrackServiceWorkerCore;

test("byte-range parsing supports bounded and open-ended ranges", () => {
  assert.deepEqual(core.parseRangeHeader("bytes=10-19", 100), {
    valid: true,
    start: 10,
    end: 19,
    total: 100,
    length: 10,
  });

  assert.deepEqual(core.parseRangeHeader("bytes=90-", 100), {
    valid: true,
    start: 90,
    end: 99,
    total: 100,
    length: 10,
  });
});

test("out-of-bounds byte ranges are reported as invalid", () => {
  assert.deepEqual(core.parseRangeHeader("bytes=100-", 100), {
    valid: false,
    total: 100,
  });

  assert.equal(core.parseRangeHeader("not-a-range", 100), null);
});

test("offline cache summary counts complete tracks and individual resources", () => {
  assert.deepEqual(
    core.summarizeOfflineMatches([
      [true, true, true, true],
      [true, false, true, false],
    ]),
    {
      completeTracks: 1,
      totalTracks: 2,
      cachedResources: 6,
      totalResources: 8,
      complete: false,
    }
  );

  assert.equal(
    core.summarizeOfflineMatches([
      [true, true, true, true],
      [true, true, true, true],
    ]).complete,
    true
  );
});
