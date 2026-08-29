// One runnable check for the generation-brief content hash (Creative Production). No frameworks.
// Run: node --experimental-strip-types scripts/check-cp-brief-hash.ts
import assert from "node:assert/strict";
import { briefHash, briefsAreEqual } from "../lib/creative-production/generation/brief-hash.ts";
import type { GenerationBrief } from "../lib/creative-production/types.ts";

function makeBrief(): GenerationBrief {
  return {
    brandDNA: {
      palette: { primary: "#0a0", secondary: "#fff", background: "#000", text: "#eee" },
      fonts: { heading: "Inter", body: "Inter" },
      logoUrl: null,
      imageStyle: "lifestyle",
      designStyle: "minimal",
      ctaStyle: "pill",
      tone: "warm",
      density: "low",
      source: "derived",
      version: 3,
    },
    productDNA: { productId: "p1", name: "Aloe Serum", images: ["i1", "i2"], price: 20, discount: 5 },
    format: {
      id: "meta-feed-1x1",
      platform: "meta",
      name: "Meta Feed 1:1",
      width: 1080,
      height: 1080,
      aspectRatio: "1:1",
      purpose: "feed",
      safeZone: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
      textConstraints: "short",
      exportFormat: "png",
      version: "1",
      source: "https://example.com/specs",
    },
    concept: {
      id: "c1",
      formatId: "before-after",
      hook: "Tired skin?",
      angle: "transformation",
      headline: "Glow in 7 days",
      supportingCopy: "Clinically loved",
      cta: "Shop now",
      offer: "20% off",
      visualDirection: "split frame before/after",
    },
    aspectRatioRequest: "1:1",
    restrictions: ["no medical claims", "keep logo", "no competitor names"],
    requiredProductFidelity: true,
    negativeInstructions: ["no text artifacts"],
    referenceImages: ["i1"],
    promptVersion: "v1",
  };
}

// Identical briefs -> same hash (cache hit).
const a = makeBrief();
const b = makeBrief();
assert.equal(briefHash(a), briefHash(b), "identical briefs -> same hash");
assert.ok(briefsAreEqual(a, b), "briefsAreEqual true for identical briefs");

// Changing an output-determining field (headline) changes the hash.
const c = makeBrief();
c.concept.headline = "Glow in 3 days";
assert.notEqual(briefHash(a), briefHash(c), "changed headline -> different hash");
assert.ok(!briefsAreEqual(a, c), "briefsAreEqual false when headline differs");

// Reordering a restrictions array does NOT change the hash (order-independent set).
const d = makeBrief();
d.restrictions = ["no competitor names", "no medical claims", "keep logo"];
assert.equal(briefHash(a), briefHash(d), "reordered restrictions -> same hash");

// Reordering reference/product images likewise doesn't bust the cache.
const e = makeBrief();
e.productDNA.images = ["i2", "i1"];
assert.equal(briefHash(a), briefHash(e), "reordered product images -> same hash");

// Hash is exactly 8 lowercase hex chars.
assert.match(briefHash(a), /^[0-9a-f]{8}$/, "hash is 8 hex chars");

console.log("PASS: brief hash (identical=same, headline-change=diff, restrictions order-independent, 8-hex)");
