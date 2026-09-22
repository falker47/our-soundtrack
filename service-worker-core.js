(() => {
  function parseRangeHeader(rangeHeader, byteLength) {
    if (!rangeHeader) return null;

    const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
    if (!match) return null;

    const start = Number(match[1]);
    const requestedEnd = match[2] ? Number(match[2]) : byteLength - 1;
    const end = Math.min(requestedEnd, byteLength - 1);

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      start > end ||
      start >= byteLength
    ) {
      return Object.freeze({ valid: false, total: byteLength });
    }

    return Object.freeze({
      valid: true,
      start,
      end,
      total: byteLength,
      length: end - start + 1,
    });
  }

  async function rangeResponse(request, cachedResponse) {
    const rangeHeader = request.headers.get("range");
    if (!rangeHeader) return cachedResponse;

    const body = await cachedResponse.arrayBuffer();
    const parsedRange = parseRangeHeader(rangeHeader, body.byteLength);

    if (!parsedRange) return cachedResponse;

    if (!parsedRange.valid) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${parsedRange.total}` },
      });
    }

    const headers = new Headers(cachedResponse.headers);
    headers.set("Accept-Ranges", "bytes");
    headers.set(
      "Content-Range",
      `bytes ${parsedRange.start}-${parsedRange.end}/${parsedRange.total}`
    );
    headers.set("Content-Length", String(parsedRange.length));

    return new Response(body.slice(parsedRange.start, parsedRange.end + 1), {
      status: 206,
      statusText: "Partial Content",
      headers,
    });
  }

  function summarizeOfflineMatches(trackMatches) {
    let cachedResources = 0;
    let completeTracks = 0;

    for (const matches of trackMatches) {
      const normalized = Array.from(matches, Boolean);
      cachedResources += normalized.filter(Boolean).length;
      if (normalized.length > 0 && normalized.every(Boolean)) {
        completeTracks += 1;
      }
    }

    const totalTracks = trackMatches.length;
    const totalResources = trackMatches.reduce(
      (sum, matches) => sum + matches.length,
      0
    );

    return Object.freeze({
      completeTracks,
      totalTracks,
      cachedResources,
      totalResources,
      complete: totalTracks > 0 && completeTracks === totalTracks,
    });
  }

  globalThis.SoundtrackServiceWorkerCore = Object.freeze({
    parseRangeHeader,
    rangeResponse,
    summarizeOfflineMatches,
  });
})();
