// Phase 2 pattern-extraction pure core. Run: npm run check:creative-os-extract
import { strict as assert } from "node:assert";
import { buildExtractPrompt, parsePatterns, dedupePatterns, normalizeExtractItems, MAX_EXTRACT_ITEMS } from "../lib/creative-os/extract-pure.ts";
import { PATTERN_TYPES } from "../lib/creative-os/schema.ts";

function main() {
  // Prompt names the exact taxonomy + demands JSON-only.
  const prompt = buildExtractPrompt({ caption: "POV: you finally fixed your sleep", comments: ["I struggle with this every night"] });
  for (const t of PATTERN_TYPES) assert.ok(prompt.includes(t), `prompt missing taxonomy type "${t}"`);
  assert.ok(/JSON array/i.test(prompt), "prompt must demand a JSON array");
  assert.ok(prompt.includes("finally fixed your sleep"), "prompt must include the caption");

  const ctx = { brandId: "b1", source: "competitor" as const, sourceRef: "https://x/ad/1" };

  // Parses valid JSON, drops unknown types, keeps provenance.
  const drafts = parsePatterns(
    '[{"type":"hook","text":"POV: you finally fixed your sleep"},{"type":"nonsense","text":"x"},{"type":"objection","text":"too expensive"}]',
    ctx,
  );
  assert.equal(drafts.length, 2, "keeps 2 valid, drops the unknown type");
  assert.equal(drafts[0].type, "hook");
  assert.equal(drafts[0].source, "competitor");
  assert.equal(drafts[0].sourceRef, "https://x/ad/1");
  assert.equal(drafts[0].brandId, "b1");

  // Tolerates ```json fences.
  const fenced = parsePatterns('```json\n[{"type":"angle","text":"transformation"}]\n```', ctx);
  assert.equal(fenced.length, 1);
  assert.equal(fenced[0].type, "angle");

  // Fail-safe: bad JSON / empty -> [], never throws.
  assert.deepEqual(parsePatterns("not json", ctx), []);
  assert.deepEqual(parsePatterns(null, ctx), []);
  assert.deepEqual(parsePatterns('{"not":"an array"}', ctx), []);

  // Dedupe by type+normalized text.
  const deduped = dedupePatterns([
    { brandId: null, type: "hook", text: "Fix your  sleep", source: "own_ad", sourceRef: null, performance: null, evidence: null },
    { brandId: null, type: "hook", text: "fix your sleep", source: "own_ad", sourceRef: null, performance: null, evidence: null },
    { brandId: null, type: "angle", text: "fix your sleep", source: "own_ad", sourceRef: null, performance: null, evidence: null },
  ]);
  assert.equal(deduped.length, 2, "same hook text collapses; a different type stays");

  // normalizeExtractItems: drops empties + bad shapes, defaults bad source to "manual", caps the batch.
  const norm = normalizeExtractItems({
    items: [
      { caption: "hook line", source: "competitor", sourceRef: "u1", brandId: "b1" },
      { source: "review" }, // no content -> dropped
      { reviewText: "too pricey", source: "not-a-source" }, // bad source -> manual
      "junk",
    ],
  });
  assert.equal(norm.length, 2, "keeps the 2 with content, drops the empty + the string");
  assert.equal(norm[0].ctx.source, "competitor");
  assert.equal(norm[0].input.caption, "hook line");
  assert.equal(norm[1].ctx.source, "manual", "unknown source falls back to manual");
  assert.deepEqual(normalizeExtractItems({}), [], "no items -> []");
  assert.ok(normalizeExtractItems({ items: Array(100).fill({ caption: "x", source: "manual" }) }).length === MAX_EXTRACT_ITEMS, "batch capped");

  console.log("PASS: creative-os extract (prompt taxonomy, JSON parse + validation, fences, fail-safe, dedupe, request normalize)");
}

main();
