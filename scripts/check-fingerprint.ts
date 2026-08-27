// One runnable check for the deterministic creative fingerprint. No frameworks, no fixtures.
// Run: node --experimental-strip-types scripts/check-fingerprint.ts
import assert from "node:assert/strict";
import { contentHash, deterministicFingerprint, fnv1a, type CreativeAsset } from "../lib/creative/fingerprint.ts";

function asset(over: Partial<CreativeAsset> = {}): CreativeAsset {
  return {
    adId: "a1",
    creativeId: "c1",
    imageUrl: "https://cdn.example.com/img.jpg",
    videoThumbUrl: null,
    videoId: null,
    title: "Best sale ever",
    body: "Shop the summer drop now",
    ctaType: "SHOP_NOW",
    isVideo: false,
    isCarousel: false,
    assetCount: 1,
    ...over,
  };
}

// fnv1a: deterministic, 8 hex chars, stable across calls, differs on different input.
assert.equal(fnv1a("abc"), fnv1a("abc"), "fnv1a must be deterministic");
assert.match(fnv1a("abc"), /^[0-9a-f]{8}$/, "fnv1a must be 8 hex chars");
assert.notEqual(fnv1a("abc"), fnv1a("abd"), "fnv1a must vary with input");

// Same creative -> same hash (fingerprint-once identity).
assert.equal(contentHash(asset()), contentHash(asset()), "identical assets share a hash");

// A re-signed CDN url (different query string, same asset path) is the SAME creative.
assert.equal(
  contentHash(asset({ imageUrl: "https://cdn.example.com/img.jpg?sig=AAA" })),
  contentHash(asset({ imageUrl: "https://cdn.example.com/img.jpg?sig=BBB" })),
  "query-string differences must not change the identity",
);

// Changing the copy DOES change the identity (it is a different creative to a viewer).
assert.notEqual(contentHash(asset()), contentHash(asset({ body: "Totally different message" })), "copy change -> new hash");

// Format detection: carousel > video > image > unknown.
assert.equal(deterministicFingerprint(asset({ assetCount: 3 })).format, "carousel", "multi-asset = carousel");
assert.equal(deterministicFingerprint(asset({ isVideo: true, videoId: "v9" })).format, "video", "video flagged as video");
assert.equal(deterministicFingerprint(asset()).format, "image", "single image = image");
assert.equal(
  deterministicFingerprint(asset({ imageUrl: null, videoThumbUrl: null, videoId: null, isVideo: false })).format,
  "unknown",
  "no media = unknown",
);

// Deterministic facts: copy length, cta presence, hasVideo.
const fp = deterministicFingerprint(asset());
assert.equal(fp.hasCopy, true);
assert.equal(fp.headlineLength, "Best sale ever".length);
assert.equal(fp.bodyLength, "Shop the summer drop now".length);
assert.equal(fp.hasCta, true);
assert.equal(fp.ctaType, "SHOP_NOW");
assert.equal(fp.hasVideo, false);
assert.equal(fp.label, "INTERNAL CALCULATION");

// No copy / no cta reads as such, never fabricated.
const bare = deterministicFingerprint(asset({ title: null, body: "  ", ctaType: null }));
assert.equal(bare.hasCopy, false);
assert.equal(bare.hasCta, false);
assert.equal(bare.ctaType, null);

console.log("PASS: deterministic creative fingerprint (hash identity, format, copy/cta facts)");
