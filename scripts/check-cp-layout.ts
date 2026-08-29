// Runnable check for lib/creative-production/composition/layout.ts (pure layout + crop geometry).
// Run: node --experimental-strip-types scripts/check-cp-layout.ts
import assert from "node:assert/strict";
import { layoutFor, cropRegion, type Region } from "../lib/creative-production/composition/layout.ts";
import type { AdFormat } from "../lib/creative-production/types.ts";

// A 9:16 story format with a big top (.14) and bottom (.35) safe zone and .06 sides.
const story: AdFormat = {
  id: "meta-story-9x16",
  platform: "meta",
  name: "Story 9:16",
  width: 1080,
  height: 1920,
  aspectRatio: "9:16",
  purpose: "full-screen story",
  safeZone: { top: 0.14, right: 0.06, bottom: 0.35, left: 0.06 },
  textConstraints: "keep text in the central band",
  exportFormat: "png",
  version: "1",
  source: "test",
};

const EPS = 1e-6;
function inside(r: Region, box: Region, label: string): void {
  assert.ok(r.x >= box.x - EPS, `${label}.x inside safeBox`);
  assert.ok(r.y >= box.y - EPS, `${label}.y inside safeBox`);
  assert.ok(r.x + r.w <= box.x + box.w + EPS, `${label} right edge inside safeBox`);
  assert.ok(r.y + r.h <= box.y + box.h + EPS, `${label} bottom edge inside safeBox`);
  assert.ok(r.w > 0 && r.h > 0, `${label} has positive size`);
}
function overlaps(a: Region, b: Region): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// --- Layout with logo + offer: every region sits inside the safe box, headline/cta disjoint. ---
const L = layoutFor(story, { hasOffer: true, hasLogo: true });

// safeBox respects the insets exactly.
assert.equal(L.safeBox.x, 1080 * 0.06, "safeBox.x = width*left");
assert.equal(L.safeBox.y, 1920 * 0.14, "safeBox.y = height*top");
assert.equal(L.safeBox.w, 1080 * (1 - 0.06 - 0.06), "safeBox.w = width*(1-left-right)");
assert.equal(L.safeBox.h, 1920 * (1 - 0.14 - 0.35), "safeBox.h = height*(1-top-bottom)");

for (const [name, r] of Object.entries(L)) {
  if (name === "safeBox" || r === null) continue;
  inside(r as Region, L.safeBox, name);
}
assert.ok(L.logo !== null, "logo present when hasLogo");
assert.ok(L.offer !== null, "offer present when hasOffer");
assert.ok(!overlaps(L.headline, L.cta), "headline and cta do not overlap");

// --- hasOffer=false => no offer region. ---
const noOffer = layoutFor(story, { hasOffer: false, hasLogo: false });
assert.equal(noOffer.offer, null, "no offer region when hasOffer=false");
assert.equal(noOffer.logo, null, "no logo region when hasLogo=false");
assert.ok(!overlaps(noOffer.headline, noOffer.cta), "headline/cta disjoint without offer/logo");

// --- Wide 1.91:1 uses a different family (product left, text right) and stays inside safeBox. ---
const wide: AdFormat = { ...story, id: "meta-feed-1.91x1", aspectRatio: "1.91:1", width: 1200, height: 628, safeZone: { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 } };
const W = layoutFor(wide, { hasOffer: true, hasLogo: false });
for (const [name, r] of Object.entries(W)) {
  if (name === "safeBox" || r === null) continue;
  inside(r as Region, W.safeBox, name);
}
assert.ok(W.productBox.x + W.productBox.w <= W.headline.x + EPS, "wide: product column is left of the text column");
assert.ok(!overlaps(W.headline, W.cta), "wide: headline and cta do not overlap");

// --- cropRegion: 16:9-ish source (1920x1080) into a 1.91:1 target, centered + inside + right ratio. ---
const crop = cropRegion(1920, 1080, 1.91, 1);
assert.ok(crop.x >= 0 && crop.y >= 0, "crop origin inside source");
assert.ok(crop.x + crop.w <= 1920 + EPS && crop.y + crop.h <= 1080 + EPS, "crop rect inside source");
assert.ok(Math.abs(crop.x - (1920 - crop.w) / 2) < EPS, "crop centered horizontally");
assert.ok(Math.abs(crop.y - (1080 - crop.h) / 2) < EPS, "crop centered vertically");
assert.ok(Math.abs(crop.w / crop.h - 1.91) < EPS, "crop has the target 1.91:1 ratio");

console.log("PASS: cp-layout (safe-box, per-family layout, non-overlap, center-crop)");
