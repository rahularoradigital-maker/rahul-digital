// One runnable check for the topbar "exclude catalog" filter (lib/creative/fingerprint.ts
// excludeCatalogAds). No frameworks, no fixtures. Verifies catalog ads are dropped, non-catalog
// ads (image/video/carousel) stay, and an ad with no creative asset is kept (not guessed away).
// Run: node --experimental-strip-types scripts/check-catalog.ts
import assert from "node:assert/strict";
import { excludeCatalogAds, type CreativeAsset } from "../lib/creative/fingerprint.ts";

function asset(over: Partial<CreativeAsset> = {}): CreativeAsset {
  return {
    adId: "a",
    creativeId: "c",
    imageUrl: "https://cdn.example.com/img.jpg",
    videoThumbUrl: null,
    videoId: null,
    title: "Title",
    body: "Body",
    ctaType: "SHOP_NOW",
    isVideo: false,
    isCarousel: false,
    isCatalog: false,
    assetCount: 1,
    ...over,
  };
}

// A tiny "ad" the analyzed set carries; the asset lookup mirrors meta-sync's assets.get(externalId).
type Ad = { externalId: string };
const assets = new Map<string, CreativeAsset>([
  ["image", asset()],
  ["video", asset({ isVideo: true, videoId: "v1", imageUrl: null })],
  ["carousel", asset({ isCarousel: true, assetCount: 3 })],
  ["catalog", asset({ isCatalog: true, imageUrl: null })],
  // note: "missing" is deliberately absent from the map (no creative this run)
]);
const ads: Ad[] = [{ externalId: "image" }, { externalId: "video" }, { externalId: "carousel" }, { externalId: "catalog" }, { externalId: "missing" }];

const kept = excludeCatalogAds(ads, (a) => assets.get(a.externalId));
const keptIds = kept.map((a) => a.externalId);

// Catalog ad is dropped.
assert.ok(!keptIds.includes("catalog"), "catalog ad must be excluded");
// Every non-catalog format survives.
assert.ok(keptIds.includes("image"), "image ad must stay");
assert.ok(keptIds.includes("video"), "video ad must stay");
assert.ok(keptIds.includes("carousel"), "carousel ad must stay");
// An ad with no creative asset is NOT known to be catalog, so it is kept (never guess an ad away).
assert.ok(keptIds.includes("missing"), "ad with no creative asset must stay");
assert.equal(kept.length, 4, "exactly the one catalog ad is dropped");

// Purity: the input array is not mutated.
assert.equal(ads.length, 5, "excludeCatalogAds must not mutate the input");

// Default behavior (no exclusion) is the caller's job; this helper always excludes when called, so
// an all-catalog set collapses to empty and an all-image set is untouched.
assert.deepEqual(
  excludeCatalogAds([{ externalId: "catalog" }], (a) => assets.get(a.externalId)).map((a) => a.externalId),
  [],
  "an all-catalog set becomes empty",
);
assert.deepEqual(
  excludeCatalogAds([{ externalId: "image" }], (a) => assets.get(a.externalId)).map((a) => a.externalId),
  ["image"],
  "an all-image set is untouched",
);

console.log("check-catalog: OK");
