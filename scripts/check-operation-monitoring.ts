// Runnable check for monitoring/history helpers (Track A, Phase A6). Pure, no network, no env.
//   node --experimental-strip-types scripts/check-operation-monitoring.ts
// Proves the queue splits into awaiting vs decided, the outcome is stated HONESTLY (handed off, never
// "executed"), and the proposal summary reads only what A4 computed (no invented number).
import { strict as assert } from "node:assert";
import { isAwaiting, isDecided, outcomeLabel, proposalSummary } from "../lib/operations/monitoring.ts";
import type { ValidationResult } from "../lib/operations/validate.ts";

// Awaiting vs decided partition.
assert.equal(isAwaiting("ready_for_approval"), true);
assert.equal(isAwaiting("blocked"), true);
assert.equal(isAwaiting("approved"), false);
assert.equal(isDecided("approved"), true);
assert.equal(isDecided("handed_off"), true);
assert.equal(isDecided("rejected"), true);
assert.equal(isDecided("ready_for_approval"), false);

// Honest outcome wording: approved = handed off (NOT executed); rejected = no change.
assert.ok(outcomeLabel("approved").toLowerCase().includes("handed off"), "approved reads as handed off");
assert.ok(!outcomeLabel("approved").toLowerCase().includes("executed"), "never claims executed (Track A does not execute)");
assert.ok(outcomeLabel("rejected").toLowerCase().includes("no change"), "rejected reads as no change made");

// Proposal summary reads only the A4-computed values.
const val: ValidationResult = { status: "validated", violations: [], computed: { direction: "increase", appliedPct: 20, capped: true } };
assert.equal(proposalSummary("propose_budget_change", val), "increase budget by 20%");
assert.equal(proposalSummary("propose_pause", null), "pause");
assert.equal(proposalSummary("diagnose", null), "diagnose", "unknown kind falls back to the kind name");
// No computed number -> does not fabricate one.
assert.equal(proposalSummary("propose_budget_change", { status: "blocked", violations: [] }), "propose_budget_change", "no computed % -> no invented number");

console.log("OK check-operation-monitoring: awaiting/decided split, honest 'handed off' outcome, summary from computed values only.");
