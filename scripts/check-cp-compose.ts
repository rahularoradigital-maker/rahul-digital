// Runnable check for lib/creative-production/composition/compose.ts (deterministic SVG composition).
// Run: node --experimental-strip-types scripts/check-cp-compose.ts
import assert from "node:assert/strict";
import { compose } from "../lib/creative-production/composition/compose.ts";
import type { AdFormat, BrandDNA, GenerationBrief } from "../lib/creative-production/types.ts";

const format: AdFormat = {
  id: "meta-feed-1x1", platform: "meta", name: "Feed 1:1", width: 1080, height: 1080, aspectRatio: "1:1",
  purpose: "feed", safeZone: { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 }, textConstraints: "", exportFormat: "png", version: "1", source: "test",
};
const brand: BrandDNA = {
  palette: { primary: "#3b6ef5", secondary: "UNKNOWN", background: "#0e0e10", text: "#ffffff" },
  fonts: { heading: "Poppins", body: "Inter" }, logoUrl: null, imageStyle: "UNKNOWN", designStyle: "UNKNOWN",
  ctaStyle: "UNKNOWN", tone: "UNKNOWN", density: "UNKNOWN", source: "derived", version: 1,
};
const brief: GenerationBrief = {
  brandDNA: brand,
  productDNA: { productId: "p1", name: "Widget", images: [], price: 20, discount: 5 },
  format,
  concept: { id: "c1", formatId: "product-hero", hook: "", angle: "hero", headline: "Meet the Widget", supportingCopy: "The calm way to do X", cta: "Shop now", offer: "Save $5", visualDirection: "studio" },
  aspectRatioRequest: "1:1", restrictions: [], requiredProductFidelity: false, negativeInstructions: [], referenceImages: [], promptVersion: "cp-v1",
};

const approved = { headline: "Meet the Widget", subhead: "The calm way to do X", cta: "Shop now", offer: "Save $5" };

// 1) dimensions + formatId echo the target format.
const a = compose(brief, approved, null);
assert.equal(a.width, 1080);
assert.equal(a.height, 1080);
assert.equal(a.formatId, "meta-feed-1x1");

// 2) it is a self-contained SVG carrying the EXACT approved text (deterministic, no misspelling).
assert.ok(a.svg.startsWith("<svg"), "produces an svg");
assert.ok(a.svg.includes("Meet the Widget"), "headline drawn verbatim");
assert.ok(a.svg.includes("Shop now"), "cta drawn verbatim");
assert.ok(a.svg.includes("Save $5"), "offer drawn verbatim");
assert.ok(a.svg.includes('viewBox="0 0 1080 1080"'), "correct viewBox");

// 3) XML-unsafe characters in copy are escaped (never break the SVG).
const b = compose({ ...brief, concept: { ...brief.concept, headline: "Tom & Jerry <hi>" } }, { ...approved, headline: "Tom & Jerry <hi>" }, null);
assert.ok(b.svg.includes("Tom &amp; Jerry &lt;hi&gt;"), "special chars escaped");
assert.ok(!b.svg.includes("Jerry <hi>"), "no raw unescaped angle brackets from copy");

// 4) a provided AI visual is embedded; absent, only the brand background paints (no <image> visual).
const withVisual = compose(brief, approved, "data:image/png;base64,AAAA");
assert.ok(withVisual.svg.includes("<image"), "embeds the AI visual when provided");
assert.ok(!a.svg.includes("<image"), "no visual element when none provided (logo absent too)");

// 5) deterministic: same inputs -> byte-identical output (cache-safe).
assert.equal(compose(brief, approved, null).svg, a.svg, "compose is deterministic");

console.log("PASS: check-cp-compose");
