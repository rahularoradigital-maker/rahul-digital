// One runnable check for the 42 executional ad-format library (Creative Production). No frameworks.
// Run: node --experimental-strip-types scripts/check-cp-ad-format-library.ts
import assert from "node:assert/strict";
import { AD_FORMAT_LIBRARY, getAdFormat, primaryFormats } from "../lib/creative-production/formats/ad-format-library.ts";

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STAGES = new Set(["unaware", "problem", "solution", "product", "most_aware"]);
const SLOTS = new Set(["headline", "subhead", "body", "cta", "offer", "stat", "quote", "rating"]);
const PRODUCT_MODES = new Set(["composite", "in-scene", "none"]);
const SCENE_TEXT = new Set(["render", "space"]);
const CATEGORIES = new Set(["ui-mockup", "social-proof", "comparison", "urgency-offer", "editorial", "humor", "ugc", "problem-education"]);

// Exactly the 42 from the reference PDF.
assert.equal(AD_FORMAT_LIBRARY.length, 42, `expected exactly 42 ad formats, got ${AD_FORMAT_LIBRARY.length}`);

// All ids unique and kebab-case.
const ids = AD_FORMAT_LIBRARY.map((f) => f.id);
assert.equal(new Set(ids).size, ids.length, "duplicate ad-format id");
for (const id of ids) assert.ok(KEBAB.test(id), `id not kebab-case: ${id}`);

for (const f of AD_FORMAT_LIBRARY) {
  assert.ok(STAGES.has(f.awarenessStage), `${f.id}: bad awarenessStage ${f.awarenessStage}`);
  assert.ok(f.textSlots.length >= 1, `${f.id}: needs at least one textSlot`);
  for (const s of f.textSlots) assert.ok(SLOTS.has(s), `${f.id}: bad textSlot ${s}`);
  assert.ok(PRODUCT_MODES.has(f.productMode), `${f.id}: bad productMode ${f.productMode}`);
  assert.ok(SCENE_TEXT.has(f.sceneText), `${f.id}: bad sceneText ${f.sceneText}`);
  assert.ok(CATEGORIES.has(f.category), `${f.id}: bad category ${f.category}`);
  // The renderRecipe is the whole point: it must be a substantial, concrete scene instruction.
  assert.ok(f.renderRecipe.trim().length >= 60, `${f.id}: renderRecipe too thin (${f.renderRecipe.length} chars) - it must describe the actual format scene`);
  assert.ok(f.structure.trim().length > 0, `${f.id}: empty structure`);
  assert.ok(f.visualPattern.trim().length > 0, `${f.id}: empty visualPattern`);
  assert.ok(f.bestFor.trim().length > 0, `${f.id}: empty bestFor`);
  // No em dashes anywhere in the data (house rule).
  const blob = `${f.name} ${f.structure} ${f.visualPattern} ${f.renderRecipe} ${f.bestFor}`;
  assert.ok(!/[—–]/.test(blob), `${f.id}: contains an em/en dash`);
}

// getAdFormat resolves a known id and returns undefined (not throw) for an unknown one.
assert.ok(getAdFormat("reddit-post"), "getAdFormat should find reddit-post");
assert.equal(getAdFormat("does-not-exist"), undefined, "getAdFormat should return undefined for unknown id");

// primaryFormats is the source-of-truth palette and equals the library.
assert.equal(primaryFormats().length, 42, "primaryFormats must expose all 42");

// At least one of each productMode exists (the compositing pipeline branches on it).
for (const m of PRODUCT_MODES) assert.ok(AD_FORMAT_LIBRARY.some((f) => f.productMode === m), `no format uses productMode ${m}`);

console.log(`OK check-cp-ad-format-library: 42 formats, ${new Set(AD_FORMAT_LIBRARY.map((f) => f.category)).size} categories, ids unique, recipes present.`);
