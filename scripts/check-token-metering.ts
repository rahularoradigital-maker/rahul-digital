// One runnable check for the token-metering config (pure). The atomic cap itself is verified in the DB
// (spend_tokens function, migration 0024). Run: node --experimental-strip-types scripts/check-token-metering.ts
import assert from "node:assert/strict";
import { PLANS, ACTION_TOKENS, IMAGE_ACTIONS, planFor, tokensFor, isImageAllowed, periodOf } from "../lib/billing/plans.ts";

// Free must NEVER allow image generation (the one rule that keeps free <= Rs100).
assert.equal(PLANS.free.imageGen, false, "free plan must block image gen");
assert.equal(isImageAllowed("free"), false);
for (const p of ["starter", "growth", "scale"] as const) assert.equal(PLANS[p].imageGen, true, `${p} allows image gen`);

// Free tokens = 50 (Rahul's number); tiers only grow tokens.
assert.equal(PLANS.free.tokens, 50);
assert.ok(PLANS.starter.tokens < PLANS.growth.tokens && PLANS.growth.tokens < PLANS.scale.tokens, "tokens increase per tier");

// Weights reflect measured cost order: image (the cost driver) is the most expensive action, analysis the least.
assert.equal(ACTION_TOKENS.analysis, 1);
assert.equal(ACTION_TOKENS.chat, 1);
assert.ok(ACTION_TOKENS.image > ACTION_TOKENS.concept, "image costs more tokens than concept");
assert.ok(ACTION_TOKENS.concept > ACTION_TOKENS.analysis, "concept costs more tokens than analysis");
assert.equal(tokensFor("image"), ACTION_TOKENS.image);
assert.ok(IMAGE_ACTIONS.has("image"));

// A single action must never exceed the smallest plan's allowance, or that action is unusable on that plan.
const minAllowance = Math.min(...Object.values(PLANS).map((p) => p.tokens));
for (const w of Object.values(ACTION_TOKENS)) assert.ok(w <= minAllowance, "no action costs more than the smallest allowance");

// Unknown/empty plan ids fall back to free (fail-closed).
assert.equal(planFor("bogus"), "free");
assert.equal(planFor(null), "free");
assert.equal(planFor("scale"), "scale");

// periodOf is UTC YYYY-MM (a new month = a new key = monthly reset).
assert.equal(periodOf(new Date("2026-09-01T00:00:00Z")), "2026-09");
assert.equal(periodOf(new Date("2026-12-31T23:59:59Z")), "2026-12");
assert.equal(periodOf(new Date("2027-01-01T00:00:00Z")), "2027-01");

console.log("check-token-metering: OK");
