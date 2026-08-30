// Runnable check for the AI budget guardrail threshold (lib/ai/budget.ts). No I/O.
// node --experimental-strip-types scripts/check-ai-budget.ts
import assert from "node:assert/strict";
import { overBudget } from "../lib/ai/budget.ts";

// No cap set (budget 0) -> never over budget, whatever the spend.
assert.equal(overBudget(9999, 0), false, "budget 0 = no cap");
assert.equal(overBudget(0, 0), false);
// Under budget -> false; at budget -> false (strictly over); over -> true.
assert.equal(overBudget(9.99, 10), false, "under");
assert.equal(overBudget(10, 10), false, "exactly at budget is not over");
assert.equal(overBudget(10.01, 10), true, "over");
// Negative budget treated as no cap.
assert.equal(overBudget(100, -1), false, "negative budget = no cap");

console.log("PASS: AI budget guardrail threshold (no-cap, strictly-over, negative-safe)");
