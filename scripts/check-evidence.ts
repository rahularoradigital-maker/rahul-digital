// Runnable check for the evidence-tag registry (lib/scoring/evidence.ts): the A/B/C/Y
// tag-meaning map the EvidenceTag chip and MetricDrawer read. Guards the canon's doctrine
// rule 5 ("every number carries an evidence tag") against drift, and pins the honesty rule
// that a Y (judgement) tag must never masquerade as an A (platform fact).
//   node --experimental-strip-types scripts/check-evidence.ts
import assert from "node:assert/strict";
import { EVIDENCE_MEANING, evidenceAria, type EvidenceTier } from "../lib/scoring/evidence.ts";

const TIERS: EvidenceTier[] = ["A", "B", "C", "Y"];

// Exactly the four canon tiers, no more, no less.
assert.deepEqual(Object.keys(EVIDENCE_MEANING).sort(), ["A", "B", "C", "Y"], "the four canon tiers, exactly");

// Every tier carries a non-empty name + meaning.
for (const tier of TIERS) {
  const e = EVIDENCE_MEANING[tier];
  assert.ok(e.name.length > 0, `${tier} needs a name`);
  assert.ok(e.meaning.length > 0, `${tier} needs a meaning`);
}

// The canon meanings (spec.json evidence_tags) must be preserved honestly.
assert.match(EVIDENCE_MEANING.A.meaning, /build on it/i, "A: platform fact, safe to build on");
assert.match(EVIDENCE_MEANING.B.meaning, /starting line/i, "B: panel, a starting line only");
assert.match(EVIDENCE_MEANING.C.meaning, /never/i, "C: folklore, never build on / never quote");
// Y must read as our own judgement AND explicitly deny being a platform fact.
assert.match(EVIDENCE_MEANING.Y.meaning, /judgement/i, "Y: our own judgement");
assert.match(EVIDENCE_MEANING.Y.meaning, /not a platform fact/i, "Y must not masquerade as A");

// A and Y must not collapse into the same wording (the whole point is telling them apart).
assert.notEqual(EVIDENCE_MEANING.A.meaning, EVIDENCE_MEANING.Y.meaning, "A and Y stay distinct");

// evidenceAria embeds the tier + name + full meaning so a screen reader speaks the provenance.
for (const tier of TIERS) {
  const aria = evidenceAria(tier);
  const e = EVIDENCE_MEANING[tier];
  assert.ok(aria.includes(tier), `aria for ${tier} names the tier`);
  assert.ok(aria.includes(e.name), `aria for ${tier} names the tier name`);
  assert.ok(aria.includes(e.meaning), `aria for ${tier} carries the full meaning`);
}

console.log("PASS: evidence-tag registry checks");
