// One runnable check for the concept format library (Creative Production). No frameworks.
// Run: node --experimental-strip-types scripts/check-cp-concept-formats.ts
import assert from "node:assert/strict";
import { CONCEPT_FORMATS, getConceptFormat } from "../lib/creative-production/formats/concept-formats.ts";

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STAGES = new Set(["unaware", "problem", "solution", "product", "most_aware"]);
const SLOTS = new Set(["headline", "subhead", "body", "cta", "offer", "stat", "quote", "rating"]);

// At least 70 archetypes (the library is specced at 70-80).
assert.ok(CONCEPT_FORMATS.length >= 70, `expected >= 70 concept formats, got ${CONCEPT_FORMATS.length}`);

// All ids unique and kebab-case.
const ids = CONCEPT_FORMATS.map((c) => c.id);
assert.equal(new Set(ids).size, ids.length, "duplicate concept id");
for (const id of ids) assert.ok(KEBAB.test(id), `id not kebab-case: ${id}`);

for (const c of CONCEPT_FORMATS) {
  // Every format has a valid awareness stage.
  assert.ok(STAGES.has(c.awarenessStage), `${c.id}: bad awarenessStage ${c.awarenessStage}`);
  // Every format has >= 1 valid text slot.
  assert.ok(c.textSlots.length >= 1, `${c.id}: needs at least one textSlot`);
  for (const s of c.textSlots) assert.ok(SLOTS.has(s), `${c.id}: bad textSlot ${s}`);
  // Every format has a non-empty structure, visualPattern, and bestFor.
  assert.ok(c.structure.trim().length > 0, `${c.id}: empty structure`);
  assert.ok(c.visualPattern.trim().length > 0, `${c.id}: empty visualPattern`);
  assert.ok(c.bestFor.trim().length > 0, `${c.id}: empty bestFor`);
  assert.ok(c.name.trim().length > 0, `${c.id}: empty name`);
}

// getConceptFormat: hit returns the entry; miss returns undefined (never throws, never invents).
assert.equal(getConceptFormat("before-after")!.name, "Before/After");
assert.equal(getConceptFormat("problem-solution")!.awarenessStage, "problem");
assert.equal(getConceptFormat("nope-not-here"), undefined, "unknown id -> undefined");

console.log(`PASS: concept format library (${CONCEPT_FORMATS.length} archetypes, unique kebab ids, valid stages+slots, non-empty visualPattern, getConceptFormat)`);
