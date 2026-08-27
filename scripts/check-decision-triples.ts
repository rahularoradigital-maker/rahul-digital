// Runnable self-check for the labeled-triples audit foundation.
// Run: node --experimental-strip-types scripts/check-decision-triples.ts
import assert from "node:assert/strict";
import {
  buildTriple,
  tripleToRow,
  isLabeled,
  type Situation,
  type Recommendation,
  type DecisionTriple,
} from "../lib/audit/decision-triples.ts";

const situation: Situation = {
  adId: "ad_123",
  accountId: "acct_9",
  objective: "conversions",
  window: "7d",
  inputs: { spend: 1200, roas: 1.4, fatigue: "high", note: null },
  ruleId: "fatigue.v1",
};

const recommendation: Recommendation = {
  action: "refresh_creative",
  priority: "high",
  confidence: 0.82,
  why: ["frequency > 3.5", "roas down 30% week over week"],
};

// buildTriple sets judgment null + outcome null.
const fresh = buildTriple("triple_1", "2026-08-27T00:00:00Z", situation, recommendation);
assert.equal(fresh.judgment, null, "fresh judgment must be null");
assert.equal(fresh.outcome, null, "fresh outcome must be null");
assert.deepEqual(fresh.situation, situation, "situation preserved");
assert.deepEqual(fresh.recommendation, recommendation, "recommendation preserved");

// tripleToRow produces snake_case keys and preserves nested objects.
const row = tripleToRow(fresh);
assert.deepEqual(
  Object.keys(row).sort(),
  ["created_at", "id", "judgment", "outcome", "recommendation", "situation"],
  "row keys are snake_case",
);
assert.equal(row.id, "triple_1");
assert.equal(row.created_at, "2026-08-27T00:00:00Z");
assert.deepEqual(row.situation, situation, "situation nested intact");
assert.deepEqual(row.recommendation, recommendation, "recommendation nested intact");

// isLabeled is false for a fresh triple.
assert.equal(isLabeled(fresh), false, "fresh triple is not labeled");

// Still not labeled with a judgment but no outcome.
const judgedOnly: DecisionTriple = { ...fresh, judgment: "approve" };
assert.equal(isLabeled(judgedOnly), false, "judgment without outcome is not labeled");

// Still not labeled with an incomplete outcome (missing after).
const partialOutcome: DecisionTriple = {
  ...judgedOnly,
  outcome: { measuredAt: "2026-09-10T00:00:00Z", metric: "roas", before: 1.4, after: null },
};
assert.equal(isLabeled(partialOutcome), false, "incomplete outcome is not labeled");

// isLabeled is true once judgment + a complete outcome are set.
const labeled: DecisionTriple = {
  ...judgedOnly,
  outcome: { measuredAt: "2026-09-10T00:00:00Z", metric: "roas", before: 1.4, after: 1.9 },
};
assert.equal(isLabeled(labeled), true, "judgment + complete outcome is labeled");

console.log("PASS: decision triples checks");
