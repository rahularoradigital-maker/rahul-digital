// One runnable check for the ad format registry (Creative Production). No frameworks.
// Run: node --experimental-strip-types scripts/check-cp-ad-formats.ts
import assert from "node:assert/strict";
import { AD_FORMATS, getFormat, META_DEFAULT_SET, GOOGLE_DEFAULT_SET } from "../lib/creative-production/formats/ad-formats.ts";

// Every format's declared aspectRatio "W:H" matches its pixel width/height (within rounding).
for (const f of AD_FORMATS) {
  const [w, h] = f.aspectRatio.split(":").map(Number);
  assert.ok(w > 0 && h > 0, `${f.id}: aspectRatio must be "W:H" positives, got ${f.aspectRatio}`);
  const declared = w / h;
  const actual = f.width / f.height;
  assert.ok(Math.abs(declared - actual) < 0.01, `${f.id}: aspectRatio ${f.aspectRatio} (${declared.toFixed(4)}) != ${f.width}x${f.height} (${actual.toFixed(4)})`);
}

// All ids unique.
const ids = AD_FORMATS.map((f) => f.id);
assert.equal(new Set(ids).size, ids.length, "duplicate format id");

// Every safe-zone edge is a fraction in [0, 1).
for (const f of AD_FORMATS) {
  for (const edge of ["top", "right", "bottom", "left"] as const) {
    const v = f.safeZone[edge];
    assert.ok(v >= 0 && v < 1, `${f.id}: safeZone.${edge}=${v} must be a 0..1 fraction`);
  }
}

// The 4 Meta core sizes exist with EXACT verified px (these are the contract; do not drift).
const metaCore: Record<string, [number, number]> = {
  "meta-feed-1x1": [1080, 1080],
  "meta-feed-4x5": [1080, 1350],
  "meta-story-9x16": [1080, 1920],
  "meta-link-1.91x1": [1200, 628],
};
for (const [id, [w, h]] of Object.entries(metaCore)) {
  const f = getFormat(id);
  assert.ok(f, `missing Meta core format ${id}`);
  assert.equal(f!.platform, "meta", `${id} must be a meta format`);
  assert.equal(f!.width, w, `${id} width must be exactly ${w}`);
  assert.equal(f!.height, h, `${id} height must be exactly ${h}`);
  assert.equal(f!.exportFormat, "png", `${id} exportFormat must be png`);
}

// The Meta 9:16 unified safe zone matches the verified Mar-2026 numbers exactly.
const story = getFormat("meta-story-9x16")!;
assert.deepEqual(story.safeZone, { top: 0.14, right: 0.06, bottom: 0.35, left: 0.06 }, "9:16 safe zone must be top .14 / sides .06 / bottom .35");

// getFormat: hit returns the same object; miss returns undefined (never throws, never invents).
assert.equal(getFormat("meta-feed-1x1")!.name, "Meta Feed Square");
assert.equal(getFormat("does-not-exist"), undefined, "unknown id -> undefined");

// Default sets resolve to real, in-registry formats matching the documented dimensions.
assert.deepEqual(META_DEFAULT_SET.map((f) => f.id), ["meta-feed-1x1", "meta-feed-4x5", "meta-story-9x16", "meta-link-1.91x1"]);
assert.deepEqual(META_DEFAULT_SET.map((f) => `${f.width}x${f.height}`), ["1080x1080", "1080x1350", "1080x1920", "1200x628"], "META_DEFAULT_SET is the cross-platform default set");
assert.ok(GOOGLE_DEFAULT_SET.length >= 3, "GOOGLE_DEFAULT_SET must include at least the RDA trio");
for (const f of [...META_DEFAULT_SET, ...GOOGLE_DEFAULT_SET]) assert.ok(getFormat(f.id), `default-set format ${f.id} must be in AD_FORMATS`);

console.log(`PASS: ad format registry (${AD_FORMATS.length} formats, aspect-ratio<->px, unique ids, Meta core px, 9:16 safe zone, getFormat, default sets)`);
