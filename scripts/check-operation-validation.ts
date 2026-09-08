// Runnable check for deterministic operation validation (Track A, Phase A4). Pure, no network, no env.
//   node --experimental-strip-types scripts/check-operation-validation.ts
// Proves the number is computed by CODE, not the AI: the budget step is capped at the rule, a scale below the
// floor ROAS is blocked, a protected campaign is refused for pause, and no amount is never invented.
import { strict as assert } from "node:assert";
import { validateOperation, parsePercent } from "../lib/operations/validate.ts";
import type { Operation, OperationKind, OperationSlots } from "../lib/operations/types.ts";

const op = (kind: OperationKind, slots: OperationSlots): Operation => ({ kind, status: "draft", source: "ask", intentText: "x", slots, evidence: [] });

// parsePercent: words + numbers, deterministic.
assert.equal(parsePercent("20%"), 20);
assert.equal(parsePercent("raise by 30"), 30);
assert.equal(parsePercent("double"), 100);
assert.equal(parsePercent("half"), 50);
assert.equal(parsePercent("a lot"), null, "unparseable -> null (never invent a number)");

// 1) Budget increase on a loser below the floor ROAS -> BLOCKED (do not scale below floor).
const r1 = validateOperation(op("propose_budget_change", { target: "ad_42", direction: "increase", magnitudeHint: "30%" }), { minRoas: 2.5, maxBudgetStepPct: 20 }, { roas: 0 });
assert.equal(r1.status, "blocked");
assert.ok(r1.violations[0].includes("below your floor"), "floor ROAS blocks a scale-up");

// 2) Budget increase 30% with a 20% cap and healthy ROAS -> VALIDATED, capped to 20 (code computes it).
const r2 = validateOperation(op("propose_budget_change", { target: "ad_7", direction: "increase", magnitudeHint: "30%" }), { minRoas: 2.5, maxBudgetStepPct: 20 }, { roas: 5 });
assert.equal(r2.status, "validated");
assert.equal(r2.computed?.appliedPct, 20, "the applied % is the capped value, computed deterministically");
assert.equal(r2.computed?.requestedPct, 30);
assert.equal(r2.computed?.capped, true);

// 3) Budget increase 10% under a 20% cap -> VALIDATED, applied 10, not capped.
const r3 = validateOperation(op("propose_budget_change", { target: "ad_7", direction: "increase", magnitudeHint: "10%" }), { minRoas: 2.5, maxBudgetStepPct: 20 }, { roas: 5 });
assert.equal(r3.computed?.appliedPct, 10);
assert.equal(r3.computed?.capped, false);

// 4) No amount given -> BLOCKED (never invent one).
const r4 = validateOperation(op("propose_budget_change", { target: "ad_7", direction: "increase" }), { maxBudgetStepPct: 20 }, { roas: 5 });
assert.equal(r4.status, "blocked");
assert.ok(r4.violations[0].toLowerCase().includes("no amount"));

// 5) No cap rule set -> VALIDATED with an honest note, applied = requested (does not fabricate a cap).
const r5 = validateOperation(op("propose_budget_change", { target: "ad_7", direction: "increase", magnitudeHint: "40%" }), {}, { roas: 5 });
assert.equal(r5.status, "validated");
assert.equal(r5.computed?.appliedPct, 40);
assert.ok(r5.violations[0].toLowerCase().includes("no max budget-step rule"));

// 6) Pause a PROTECTED campaign -> BLOCKED.
const r6 = validateOperation(op("propose_pause", { target: "Always-On Brand hook" }), { protectedCampaigns: ["Always-On Brand"] }, { name: "Always-On Brand hook", campaignName: "Always-On Brand" });
assert.equal(r6.status, "blocked");
assert.ok(r6.violations[0].includes("protected campaign"));

// 7) Pause a normal loser -> VALIDATED.
const r7 = validateOperation(op("propose_pause", { target: "SP loser" }), { protectedCampaigns: ["Always-On Brand"] }, { name: "SP loser", campaignName: "Festive Sale" });
assert.equal(r7.status, "validated");
assert.equal(r7.computed?.action, "pause");

// 8) Reads have no parameters to validate.
assert.equal(validateOperation(op("diagnose", {}), {}, {}).status, "not_applicable");
assert.equal(validateOperation(op("answer", {}), {}, {}).status, "not_applicable");

console.log("OK check-operation-validation: number capped by code, floor ROAS + protected campaign enforced, no amount never invented.");
