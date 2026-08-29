// Runnable check for lib/creative-production/qa/qa-engine.ts (pure QA scoring).
// Run: node --experimental-strip-types scripts/check-cp-qa.ts
import assert from "node:assert/strict";
import { runQA } from "../lib/creative-production/qa/qa-engine.ts";
import type { AdFormat, ComposedAsset, GenerationBrief } from "../lib/creative-production/types.ts";

const metaFmt: AdFormat = {
  id: "meta-feed-1x1",
  platform: "meta",
  name: "Feed 1:1",
  width: 1080,
  height: 1080,
  aspectRatio: "1:1",
  purpose: "feed",
  safeZone: { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 },
  textConstraints: "",
  exportFormat: "png",
  version: "1",
  source: "test",
};

// Minimal type-correct brief; only fields runQA reads matter, the rest satisfy the contract.
function makeBrief(over: { format?: AdFormat; requiredProductFidelity?: boolean; offer?: string | null } = {}): GenerationBrief {
  const format = over.format ?? metaFmt;
  return {
    brandDNA: {} as GenerationBrief["brandDNA"],
    productDNA: { productId: "p1", name: "Widget", images: [], price: 20, discount: null },
    format,
    concept: {
      id: "c1",
      formatId: format.id,
      hook: "h",
      angle: "a",
      headline: "Buy the Widget",
      supportingCopy: "It is good",
      cta: "Shop now",
      offer: over.offer ?? null,
      visualDirection: "studio",
    },
    aspectRatioRequest: "1:1",
    restrictions: [],
    requiredProductFidelity: over.requiredProductFidelity ?? true,
    negativeInstructions: [],
    referenceImages: [],
    promptVersion: "v1",
  };
}

function asset(w: number, h: number, formatId = "meta-feed-1x1"): ComposedAsset {
  return { formatId, width: w, height: h, svg: "" };
}
const approved = { headline: "Buy the Widget", cta: "Shop now", offer: null };

// 1) Matching dims, no fidelity risk, good contrast => READY.
const ready = runQA(asset(1080, 1080), makeBrief(), approved, { contrastRatio: 7, textPixelsPresent: true, fileBytes: 500_000 });
assert.equal(ready.status, "READY", "clean asset is READY");
assert.ok(ready.checks.every((c) => c.pass), "no failing checks on a READY asset");

// 2) Wrong dimensions => FAILED (critical).
const badDims = runQA(asset(800, 800), makeBrief(), approved, { contrastRatio: 7 });
assert.equal(badDims.status, "FAILED", "dimension mismatch is FAILED");
assert.ok(badDims.checks.some((c) => c.name === "aspect_resolution" && !c.pass && c.severity === "critical"), "critical aspect_resolution fail");

// 3) productFidelityRisk + requiredProductFidelity => FAILED.
const fidelity = runQA(asset(1080, 1080), makeBrief({ requiredProductFidelity: true }), approved, { contrastRatio: 7, productFidelityRisk: true });
assert.equal(fidelity.status, "FAILED", "product fidelity drift with required fidelity is FAILED");
assert.ok(fidelity.checks.some((c) => c.name === "product_fidelity" && !c.pass), "product_fidelity failed");

// 3b) Same drift but fidelity NOT required => not a fail.
const noFidelityReq = runQA(asset(1080, 1080), makeBrief({ requiredProductFidelity: false }), approved, { contrastRatio: 7, productFidelityRisk: true });
assert.equal(noFidelityReq.status, "READY", "drift without required fidelity does not fail");

// 4) Low contrast alone => REVIEW (warning only, never READY-with-crit, never FAILED).
const lowContrast = runQA(asset(1080, 1080), makeBrief(), approved, { contrastRatio: 3.0, fileBytes: 500_000 });
assert.equal(lowContrast.status, "REVIEW", "low contrast alone is REVIEW");
assert.ok(lowContrast.checks.every((c) => c.severity !== "critical" || c.pass), "no critical fails behind a REVIEW");

// 5) Oversized file (> platform cap) => FAILED. Meta cap is 30MB.
const huge = runQA(asset(1080, 1080), makeBrief(), approved, { contrastRatio: 7, fileBytes: 31 * 1024 * 1024 });
assert.equal(huge.status, "FAILED", "over the platform file cap is FAILED");

// Guard the invariant directly: a critical fail must never surface as READY.
for (const r of [badDims, fidelity, huge]) {
  assert.notEqual(r.status, "READY", "critical failure is never READY");
}

console.log("PASS: cp-qa (READY/REVIEW/FAILED derivation, critical vs warning severity)");
