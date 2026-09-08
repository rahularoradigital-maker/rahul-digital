// Runnable check for the operation contract (Track A, Phase A1). Pure, no network, no env.
//   node --experimental-strip-types scripts/check-operation-contract.ts
// Proves the DETERMINISTIC half of interpretation: a valid action normalizes to draft; an action missing
// its required slots becomes needs_clarification with a question (never a guess); an unknown kind is not
// trusted; and the AI can NEVER smuggle an authoritative number through (only the raw hint survives).
import { strict as assert } from "node:assert";
import { normalizeOperation, KNOWN_KINDS } from "../lib/operations/contract.ts";

// 1) A well-formed budget-change proposal -> draft, kind + slots preserved.
const ok = normalizeOperation(
  { kind: "propose_budget_change", slots: { target: "ad_42", direction: "increase", magnitudeHint: "20%" } },
  "ask",
  "raise ad_42 budget by 20%",
);
assert.equal(ok.kind, "propose_budget_change");
assert.equal(ok.status, "draft", "valid action with required slots is a draft");
assert.equal(ok.slots.direction, "increase");
assert.equal(ok.slots.magnitudeHint, "20%", "the raw phrase is kept as a hint");
assert.equal(ok.intentText, "raise ad_42 budget by 20%");

// 2) Budget change missing direction -> needs_clarification + a specific question (no guessing).
const missing = normalizeOperation({ kind: "propose_budget_change", slots: { target: "ad_42" } }, "ask", "change ad_42 budget");
assert.equal(missing.status, "needs_clarification");
assert.ok(missing.clarify && /raise or lower/i.test(missing.clarify), "asks which direction");

// 3) Unknown / hallucinated kind is NOT trusted -> needs_clarification.
const unknown = normalizeOperation({ kind: "delete_everything", slots: {} }, "ask", "nuke the account");
assert.equal(unknown.status, "needs_clarification");
assert.equal(unknown.kind, "answer", "unknown kind falls back to a safe answer kind, not the invented one");

// 4) "the less AI, the better": a model that tries to set an authoritative number CANNOT smuggle it through.
// Only the allow-listed hint fields survive; there is no numeric field on the operation at all.
const sneaky = normalizeOperation(
  { kind: "propose_budget_change", slots: { target: "ad_42", direction: "increase", newBudget: 999999, amount: 500 } as Record<string, unknown> },
  "ask",
  "raise it a lot",
);
assert.equal(sneaky.status, "draft");
assert.ok(!("newBudget" in sneaky.slots), "an AI-invented budget number is dropped");
assert.ok(!("amount" in sneaky.slots), "an AI-invented amount is dropped");
assert.deepEqual(Object.keys(sneaky.slots).sort(), ["direction", "magnitudeHint", "note", "objective", "scope", "target"], "only hint fields survive");

// 5) An invalid direction value is coerced to null (not trusted as an enum).
const baddir = normalizeOperation({ kind: "propose_pause", slots: { target: "adset_9", direction: "obliterate" } as Record<string, unknown> }, "ask", "kill adset_9");
assert.equal(baddir.slots.direction, null, "an out-of-enum direction becomes null");
assert.equal(baddir.kind, "propose_pause");
assert.equal(baddir.status, "draft", "pause only needs a target");

// 6) A plain question -> answer kind, draft (routes to Ask), never needs slots.
const q = normalizeOperation({ kind: "answer", slots: {} }, "ask", "what is my best ad this week?");
assert.equal(q.kind, "answer");
assert.equal(q.status, "draft");

// 7) A null model reply degrades safely.
const nul = normalizeOperation(null, "ask", "something");
assert.equal(nul.status, "needs_clarification");
assert.equal(nul.kind, "answer");

// 8) evidence is kept only when it is real strings, capped.
const ev = normalizeOperation({ kind: "diagnose", slots: {}, evidence: ["frequency rising", 42, null] as unknown[] }, "ask", "why is ad_42 slowing");
assert.deepEqual(ev.evidence, ["frequency rising"], "non-string evidence entries are dropped");
assert.equal(ev.status, "draft", "diagnose needs no slots (defaults to account)");

assert.equal(KNOWN_KINDS.length, 6, "the known-kind list is the single source of truth");

console.log("OK check-operation-contract: kinds validated, missing slots -> clarify, no AI number smuggled, safe degrade.");
