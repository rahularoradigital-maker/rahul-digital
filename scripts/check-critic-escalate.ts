// Proof for the AI-critic escalation planner (§53-56/§70): escalate only high-stakes, upheld, confident
// decisions, ranked by ₹, within budget; cost is bounded. Run: node --experimental-strip-types scripts/check-critic-escalate.ts

import assert from "node:assert/strict";
import type { OutputContract } from "../lib/intelligence/output-contract.ts";
import { planEscalation } from "../lib/intelligence/critic-escalate.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const c = (id: string, rs: number, conf: OutputContract["confidence"], tier: OutputContract["trust"]["tier"] = "CALCULATED", wcw = "clean"): OutputContract => ({
  id, kind: "winner", entity: { level: "ad", id, name: id },
  data: { summary: "s", source: "meta-store" }, trust: { ok: true, tier, reason: "ok" },
  decision: { call: "Scale", why: "w" }, economicImpactRs: rs, confidence: conf, whatCouldBeWrong: wcw,
});
const hold: OutputContract = { id: "h", kind: "fatigue", data: { summary: "s", source: "m" }, trust: { ok: false, tier: "UNKNOWN", reason: "thin" }, confidence: "low", whatCouldBeWrong: "wait" };

const cs = [
  c("big", 90000, "high"),   // qualifies, top ₹
  c("mid", 40000, "high"),   // qualifies
  c("cheap", 2000, "high"),  // below the ₹ floor -> skip
  c("lowconf", 80000, "low"), // low confidence -> not the dangerous kind -> skip
  c("flagged", 70000, "high", "INFERENCE"), // free critic downgrades (high on INFERENCE) -> not "upheld" -> skip
  hold,                      // no decision -> skip
];

const plan = planEscalation(cs, { maxCalls: 5, costPerCallUsd: 0.02 });
ok(plan.candidates === 2, "only high-stakes, upheld, confident decisions qualify (big + mid)");
ok(plan.escalate[0].id === "big" && plan.escalate[1].id === "mid", "escalation ranked by money at stake");
ok(plan.projectedCostUsd === 0.04, "cost = 2 calls x $0.02");

// budget caps the number of calls.
const capped = planEscalation(cs, { maxCalls: 1, costPerCallUsd: 0.02 });
ok(capped.escalate.length === 1 && capped.escalate[0].id === "big" && capped.projectedCostUsd === 0.02, "budget cap keeps only the top call");

// zero budget -> nothing escalated, zero cost.
ok(planEscalation(cs, { maxCalls: 0, costPerCallUsd: 0.02 }).escalate.length === 0, "zero budget -> no escalation");

console.log(`check-critic-escalate: ${pass} assertions passed.`);
