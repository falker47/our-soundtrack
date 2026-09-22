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

test("cached media range requests return 206 with the requested bytes", async () => {
  const bytes = Uint8Array.from({ length: 100 }, (_, index) => index);
  const cached = new Response(bytes, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg" },
  });
  const request = new Request("https://example.test/song.mp3", {
    headers: { Range: "bytes=10-19" },
  });

  const response = await core.rangeResponse(request, cached);

  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Content-Range"), "bytes 10-19/100");
  assert.equal(response.headers.get("Content-Length"), "10");
  assert.equal((await response.arrayBuffer()).byteLength, 10);
});

test("out-of-bounds cached media ranges return 416", async () => {
  const cached = new Response(new Uint8Array(100), { status: 200 });
  const request = new Request("https://example.test/song.mp3", {
    headers: { Range: "bytes=100-" },
  });

  const response = await core.rangeResponse(request, cached);

  assert.equal(response.status, 416);
  assert.equal(response.headers.get("Content-Range"), "bytes */100");
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
