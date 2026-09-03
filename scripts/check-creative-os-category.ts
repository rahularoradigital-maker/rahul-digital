// Phase 4/5 category map + white-space. Run: npm run check:creative-os-category
import { strict as assert } from "node:assert";
import { distribution, categoryMap, whiteSpace } from "../lib/creative-os/category.ts";
import type { CreativePattern } from "../lib/creative-os/schema.ts";

let n = 0;
function p(type: CreativePattern["type"], text: string, sourceRef: string): CreativePattern {
  return { id: `p${n++}`, brandId: null, type, text, source: "competitor", sourceRef, performance: null, evidence: null, createdAt: "" };
}

function main() {
  // Distribution: shares sum to 1, sorted by count desc.
  const angles = [p("angle", "problem", "c1"), p("angle", "problem", "c2"), p("angle", "transformation", "c3")];
  const d = distribution(angles, "angle");
  assert.equal(d[0].name, "problem");
  assert.equal(d[0].count, 2);
  assert.ok(Math.abs(d.reduce((s, r) => s + r.share, 0) - 1) < 1e-9, "shares sum to 1");

  // categoryMap returns all three axes.
  const cm = categoryMap(angles);
  assert.ok(cm.angles.length === 2 && cm.personas.length === 0 && cm.formats.length === 0);

  // White space: 3 creatives all use PersonaA+Problem+UGC; PersonaA+Education+UGC is a gap (parts proven, combo absent).
  const market: CreativePattern[] = [];
  for (const c of ["c1", "c2", "c3"]) {
    market.push(p("persona", "busy mom", c), p("angle", "problem", c), p("format", "ugc", c));
  }
  // introduce "education" as a proven angle on its own creative, but never combined with busy mom + ugc
  market.push(p("persona", "student", "c4"), p("angle", "education", "c4"), p("format", "ugc", "c4"));
  const ws = whiteSpace(market);
  const gap = ws.find((w) => w.persona === "busy mom" && w.angle === "education" && w.format === "ugc");
  assert.ok(gap, "busy mom + education + ugc should surface as white space (combo absent, parts present)");
  assert.equal(gap!.marketShare, 0, "the gap combo has 0 market share");
  // a well-served combo must NOT be returned as white space
  assert.ok(!ws.some((w) => w.persona === "busy mom" && w.angle === "problem" && w.format === "ugc"), "the dominant combo is not white space");

  assert.deepEqual(whiteSpace([]), [], "empty in -> empty out");
  console.log("PASS: creative-os category (distribution shares, category map, white-space gap detection)");
}

main();
