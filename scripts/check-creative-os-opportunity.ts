// Phase 6/12 opportunity detection. Run: npm run check:creative-os-opportunity
import { strict as assert } from "node:assert";
import { detectOpportunities } from "../lib/creative-os/opportunity.ts";
import type { CreativePattern } from "../lib/creative-os/schema.ts";

let n = 0;
function p(type: CreativePattern["type"], text: string, sourceRef: string): CreativePattern {
  return { id: `p${n++}`, brandId: null, type, text, source: "competitor", sourceRef, performance: null, evidence: null, createdAt: "" };
}

function main() {
  const market: CreativePattern[] = [];
  for (const c of ["c1", "c2", "c3"]) market.push(p("persona", "busy mom", c), p("angle", "problem", c), p("format", "ugc", c));
  market.push(p("persona", "student", "c4"), p("angle", "education", "c4"), p("format", "ugc", "c4"));

  const opps = detectOpportunities(market, { limit: 5 });
  assert.ok(opps.length > 0, "produces opportunities from white space");
  const o = opps[0];
  assert.ok(o.thesis && o.thesis.length > 20, "has a plain-English thesis");
  assert.ok(o.confidence > 0 && o.confidence <= 0.8, "confidence in (0, 0.8] — a gap is a hypothesis, never certain");
  assert.ok(Array.isArray(o.evidence?.patternIds), "evidence links back to pattern ids (traceable)");
  assert.equal(o.status, "open");
  // sorted by confidence desc
  for (let i = 1; i < opps.length; i++) assert.ok(opps[i - 1].confidence >= opps[i].confidence, "sorted by confidence desc");

  assert.deepEqual(detectOpportunities([]), [], "no market -> no opportunities (no fabrication)");
  console.log("PASS: creative-os opportunity (thesis, capped confidence, traceable evidence, sorted, empty-safe)");
}

main();
