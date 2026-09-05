// Regression fixture for the "fake receipt / us-versus-them" failure (CP_FAILURE_RECEIPT_001). Locks two
// root-cause fixes: (1) a comparison/versus format is HARD-REJECTED without genuine comparison evidence (so a
// soundbar never auto-selects a fake price-receipt ad), and (2) the us-versus-them format no longer renders
// fake till-receipts/barcodes and lets the deterministic compositor draw text, not the image model.
// Run: node --experimental-strip-types scripts/check-cp-suitability.ts

import { formatSuitability } from "../lib/creative-production/strategy/concept-engine.ts";
import { AD_FORMAT_LIBRARY } from "../lib/creative-production/formats/ad-format-library.ts";
import type { ConceptFormat } from "../lib/creative-production/types.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const fmt = (id: string, name: string, slots: string[] = ["headline", "body", "cta"]): ConceptFormat =>
  ({ id, name, awarenessStage: "solution", structure: "", textSlots: slots, visualPattern: "", bestFor: "" }) as unknown as ConceptFormat;
// A face/portrait transformation format, detected from its recipe text (structure/visualPattern), not its id.
const faceFmt = ({ id: "transformation", name: "Transformation", awarenessStage: "solution", structure: "before/after portraits of the same person, 'real results'", textSlots: ["headline", "cta"], visualPattern: "split before/after portraits", bestFor: "" }) as unknown as ConceptFormat;

// (1) HARD gates: no fabricated proof.
ok(formatSuitability(fmt("us-versus-them", "Us versus them"), "solution", false, false) === 0, "comparison format with NO comparison evidence is rejected (0) - no fake receipts");
ok(formatSuitability(fmt("comparison-table", "Comparison Table"), "solution", false, true) > 0.6, "comparison format WITH evidence is allowed and boosted");
ok(formatSuitability(fmt("ugc-testimonial", "Testimonial", ["quote"]), "solution", false, false) === 0, "review/testimonial format with NO reviews is rejected (0)");
ok(formatSuitability(fmt("product-hero", "Product hero"), "solution", false, false) === 0.6, "a generic product format is fine at base suitability");

// (1b) Face/portrait transformation is HARD-REJECTED for a non-body product (no fabricated human before/after
// on a gadget), but allowed for a body-applied product (skincare/fitness), where a real transformation exists.
ok(formatSuitability(faceFmt, "solution", false, true, false) === 0, "face-transformation on a NON-body product is rejected (0) - no fabricated faces on a gadget");
ok(formatSuitability(faceFmt, "solution", false, true, true) > 0, "face-transformation on a body-applied product is allowed");
const trans = AD_FORMAT_LIBRARY.find((f) => f.id === "transformation-before-after");
ok(!!trans && formatSuitability(trans!, "solution", false, true, false) === 0, "the real Transformation format is gated off for non-body products");

// (2) The us-versus-them format itself no longer fabricates a receipt, and hands text to the compositor.
const uvt = AD_FORMAT_LIBRARY.find((f) => f.id === "us-versus-them");
ok(!!uvt, "us-versus-them format exists");
const recipe = (uvt!.renderRecipe ?? "").toLowerCase();
ok(!/till-receipt|receipts (hanging|side by side|printed)|printed from register/.test(recipe), "renderRecipe no longer renders a fake-receipt SCENE");
ok(/no receipts/.test(recipe) && /no barcodes/.test(recipe), "recipe explicitly forbids fake receipts/barcodes");
ok(uvt!.sceneText === "space", "text is drawn by the deterministic compositor (sceneText=space), not garbled by the image model");

console.log(`check-cp-suitability: ${pass} assertions passed.`);
