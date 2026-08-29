// One runnable check for the leaderboard thumbnail URL selector. No frameworks, no fixtures.
// Run: node --experimental-strip-types scripts/check-thumb.ts
// Guards the rule the UI depends on: prefer imageUrl > videoThumbUrl > null, treating empty strings
// as absent, so a leaderboard row never tries to render a placeholder / broken image.
import assert from "node:assert/strict";
import { thumbUrlOf, type CreativeAsset } from "../lib/creative/fingerprint.ts";

function asset(over: Partial<CreativeAsset> = {}): CreativeAsset {
  return {
    adId: "a1",
    creativeId: "c1",
    imageUrl: null,
    videoThumbUrl: null,
    videoId: null,
    title: null,
    body: null,
    ctaType: null,
    isVideo: false,
    isCarousel: false,
    isCatalog: false,
    assetCount: 1,
    ...over,
  };
}

// Prefer the real image.
assert.equal(
  thumbUrlOf(asset({ imageUrl: "https://cdn/i.jpg", videoThumbUrl: "https://cdn/v.jpg" })),
  "https://cdn/i.jpg",
  "imageUrl wins when present",
);

// Fall back to the video thumbnail when there is no image.
assert.equal(
  thumbUrlOf(asset({ imageUrl: null, videoThumbUrl: "https://cdn/v.jpg" })),
  "https://cdn/v.jpg",
  "videoThumbUrl is used when imageUrl is absent",
);

// Nothing usable -> null (never a placeholder / empty string).
assert.equal(thumbUrlOf(asset()), null, "no media -> null");

// Empty strings are treated as absent, so we never hand the browser a src="".
assert.equal(thumbUrlOf(asset({ imageUrl: "", videoThumbUrl: "https://cdn/v.jpg" })), "https://cdn/v.jpg", "empty imageUrl falls through to video thumb");
assert.equal(thumbUrlOf(asset({ imageUrl: "", videoThumbUrl: "" })), null, "all-empty -> null");

console.log("PASS: thumbnail URL selector (imageUrl > videoThumbUrl > null, empty = absent)");
