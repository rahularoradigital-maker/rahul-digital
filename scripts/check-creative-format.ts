// Regression guard for the "format = Unknown for every ad" bug. Root cause was upstream (the deprecated
// ?ids= creative batch erroring -> empty asset map -> every ad had no creative -> unknown), now fixed with
// per-ad fetches. This locks in the FORMAT RESOLUTION itself: any creative with real media or a catalog marker
// must resolve to a concrete format, and ONLY a genuinely media-less creative may be "unknown".
// Run: node --experimental-strip-types scripts/check-creative-format.ts

import { deterministicFingerprint, type CreativeAsset } from "../lib/creative/fingerprint.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const base: CreativeAsset = { adId: "x", creativeId: "c", imageUrl: null, videoThumbUrl: null, videoId: null, title: "t", body: "b", ctaType: "SHOP_NOW", isVideo: false, isCarousel: false, isCatalog: false, assetCount: 1 };
const fmt = (ov: Partial<CreativeAsset>) => deterministicFingerprint({ ...base, ...ov }).format;

ok(fmt({ isCatalog: true }) === "catalog", "a catalog/DPA creative (product_set_id) -> catalog, never unknown");
ok(fmt({ imageUrl: "https://x/i.jpg" }) === "image", "a static image creative -> image");
ok(fmt({ videoId: "v1", isVideo: true }) === "video", "a video creative -> video");
ok(fmt({ isCarousel: true, assetCount: 3 }) === "carousel", "a carousel -> carousel");
ok(fmt({ assetCount: 4 }) === "carousel", "assetCount>1 alone -> carousel");
// The ONLY legitimate unknown: a creative with no media and no catalog marker (we genuinely can't tell).
ok(fmt({}) === "unknown", "a truly media-less creative -> unknown (honest, not a bug)");

// Catalog takes precedence over an accidental image url (a DPA can carry a placeholder image).
ok(fmt({ isCatalog: true, imageUrl: "https://x/ph.jpg" }) === "catalog", "catalog wins over a placeholder image");

console.log(`check-creative-format: ${pass} assertions passed.`);
