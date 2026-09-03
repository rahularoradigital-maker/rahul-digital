// Phase 6 strategist blueprint. Run: npm run check:creative-os-strategist
import { strict as assert } from "node:assert";
import { buildBlueprint, buildBlueprints } from "../lib/creative-os/strategist.ts";
import type { CreativePattern } from "../lib/creative-os/schema.ts";

let n = 0;
function pat(type: CreativePattern["type"], text: string, roas: number | null): CreativePattern {
  return { id: `p${n++}`, brandId: "b", type, text, source: "own_ad", sourceRef: null, performance: roas == null ? null : { spend: 1000, roas, impressions: 10000 }, evidence: null, createdAt: "" };
}

function main() {
  const patterns = [pat("hook", "weak hook", 1.5), pat("hook", "proven hook", 4.0), pat("proof", "10k reviews", null)];
  const bp = buildBlueprint({ persona: "busy mom", angle: "education", format: "ugc", confidence: 0.6 }, patterns);
  // Picks the highest-ROAS hook (proven, not the weak one), and includes provenance ids.
  assert.equal(bp.hook, "proven hook", "prefers the performance-proven hook");
  assert.equal(bp.proof, "10k reviews");
  assert.ok(bp.sourcePatternIds.length === 2, "keeps hook + proof provenance ids");
  assert.ok(bp.concept.includes("busy mom") && bp.concept.includes("education") && bp.concept.includes("ugc"), "concept names the territory");
  assert.ok(bp.testingHypothesis.includes("CTR") || bp.testingHypothesis.includes("hold-rate"), "hypothesis is measurable");
  assert.equal(bp.confidence, 0.6);

  // No patterns yet -> blueprint still forms, hook/proof null (honest, no fabrication).
  const bare = buildBlueprint({ persona: "x", angle: "y", format: "z", confidence: 0.3 }, []);
  assert.equal(bare.hook, null);
  assert.equal(bare.sourcePatternIds.length, 0);

  // Dedupe by territory.
  const many = buildBlueprints(
    [
      { persona: "a", angle: "b", format: "c", confidence: 0.5 },
      { persona: "A", angle: "B", format: "C", confidence: 0.4 }, // same territory, different case
      { persona: "d", angle: "e", format: "f", confidence: 0.3 },
    ],
    patterns,
  );
  assert.equal(many.length, 2, "same territory (case-insensitive) collapses");

  console.log("PASS: creative-os strategist (proven-hook pick, provenance, measurable hypothesis, empty-safe, dedupe)");
}

main();
