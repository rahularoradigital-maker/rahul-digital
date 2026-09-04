// Runnable check for the AI budget guardrail threshold (lib/ai/budget.ts). No I/O.
// node --experimental-strip-types scripts/check-ai-budget.ts
import assert from "node:assert/strict";
import { overBudget, resolveDailyBudget, resolveTenantDailyBudget } from "../lib/ai/budget.ts";

// No cap set (budget 0) -> never over budget, whatever the spend.
assert.equal(overBudget(9999, 0), false, "budget 0 = no cap");
assert.equal(overBudget(0, 0), false);
// Under budget -> false; at budget -> false (strictly over); over -> true.
assert.equal(overBudget(9.99, 10), false, "under");
assert.equal(overBudget(10, 10), false, "exactly at budget is not over");
assert.equal(overBudget(10.01, 10), true, "over");
// Negative budget treated as no cap.
assert.equal(overBudget(100, -1), false, "negative budget = no cap");

// Default ceiling: unset/garbage -> a positive default cap (never un-capped); explicit "0"/"none" -> disabled.
assert.ok(resolveDailyBudget(undefined) > 0, "unset -> a default cap, not un-capped");
assert.ok(resolveDailyBudget("") > 0, "empty -> default cap");
assert.ok(resolveDailyBudget("abc") > 0, "garbage -> default cap");
assert.equal(resolveDailyBudget("0"), 0, "explicit 0 disables the cap");
assert.equal(resolveDailyBudget("none"), 0, "explicit 'none' disables the cap");
assert.equal(resolveDailyBudget("50"), 50, "explicit number overrides the default");

// S4 per-tenant ceiling: same resolver contract, but a smaller default that must sit BELOW the global default
// (so no single tenant can consume the whole app budget), and "0"/"none" still disables it.
assert.ok(resolveTenantDailyBudget(undefined) > 0, "tenant unset -> a default cap, not un-capped");
assert.ok(resolveTenantDailyBudget("") > 0, "tenant empty -> default cap");
assert.ok(resolveTenantDailyBudget("abc") > 0, "tenant garbage -> default cap");
assert.ok(resolveTenantDailyBudget(undefined) < resolveDailyBudget(undefined), "tenant default must be below the global default (whale cannot eat the whole budget)");
assert.equal(resolveTenantDailyBudget("0"), 0, "tenant explicit 0 disables the cap");
assert.equal(resolveTenantDailyBudget("none"), 0, "tenant explicit 'none' disables the cap");
assert.equal(resolveTenantDailyBudget("3"), 3, "tenant explicit number overrides the default");

console.log("PASS: AI budget guardrail threshold (default-cap, no-cap, strictly-over, negative-safe; global + per-tenant)");
