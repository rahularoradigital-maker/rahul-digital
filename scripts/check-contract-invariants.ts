// Golden cross-adapter invariants (§77): the §110 law must hold no matter WHICH engine produced the output.
// Runs representative outputs from every adapter and every hold()/decide() path through validateOutput and
// asserts the universal rules - so a future adapter that violates the chain fails here, not in front of a
// buyer. Run: node --experimental-strip-types scripts/check-contract-invariants.ts

import assert from "node:assert/strict";
import { hold, decide, validateOutput, type OutputContract } from "../lib/intelligence/output-contract.ts";
import { culpritToContract } from "../lib/intelligence/from-culprit.ts";
import { fatigueToContract } from "../lib/intelligence/from-fatigue.ts";
import { funnelToContract } from "../lib/intelligence/from-funnel.ts";
import { winnerToContract } from "../lib/intelligence/from-winner.ts";
import type { CulpritDiagnosis } from "../lib/scoring/culprit.ts";
import type { AdDiagnosis } from "../lib/funnel/diagnosis.ts";
import type { CockpitAd } from "../lib/cockpit/analyze.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// A battery of real outputs from across the adapters (a "golden" set).
const outputs: (OutputContract | null)[] = [
  culpritToContract({ dropped: true, metric: "revenue", dropPct: 0.4, recentRs: 60000, priorRs: 100000, culprits: [{ id: "c", name: "X", priorSpendRs: 60000, recentSpendRs: 0, stoppedOn: null, shareOfPrior: 0.6 }], summary: "x" } as CulpritDiagnosis, { entityId: "a" }),
  culpritToContract({ dropped: false, metric: "revenue", dropPct: 0, recentRs: 99, priorRs: 100, culprits: [], summary: null } as CulpritDiagnosis, { entityId: "a" }),
  fatigueToContract({ id: "f", name: "F", objective: "traffic", conversions: 0, spendRs: 1000, wastedRs: 0, verdict: "refresh", score: 30, confidence: 0.6, why: ["y"], action: { label: "Hold", priority: "low" }, delivering: true, active: true } as unknown as CockpitAd),
  funnelToContract({ adId: "u", name: "U", objective: "traffic", stage: { label: "MOF" }, spend: 20000, metrics: {}, steps: [], leak: { key: "lpv", label: "LPV", value: 0.3, ownBest: 0.6, objectiveAvg: 0.4, gap: 0.5 }, hold: null } as unknown as AdDiagnosis),
  funnelToContract({ adId: "u2", name: "U2", objective: "traffic", stage: { label: "TOF" }, spend: 500, metrics: {}, steps: [], leak: null, hold: "too little spend" } as unknown as AdDiagnosis),
  winnerToContract({ id: "w", name: "W", spendRs: 90000, delivering: true, active: true, winner: { quality: 75, scale: 70, stability: 70, opportunity: 50, overall: 72, label: "INTERNAL CALCULATION", why: ["z"] } } as unknown as CockpitAd),
  // HOLD cases: a sales-objective ad under the conversion floor, and a winner with too little proven spend.
  fatigueToContract({ id: "fh", name: "FH", objective: "conversion", conversions: 3, spendRs: 20000, wastedRs: 0, verdict: "refresh", score: 30, confidence: 0.5, why: ["y"], action: { label: "Refresh", priority: "high" }, delivering: true, active: true } as unknown as CockpitAd),
  winnerToContract({ id: "wh", name: "WH", spendRs: 4000, delivering: true, active: true, winner: { quality: 80, scale: 10, stability: 70, opportunity: 80, overall: 65, label: "INTERNAL CALCULATION", why: ["z"] } } as unknown as CockpitAd),
];

let decided = 0, held = 0;
for (const c of outputs) {
  if (!c) continue;
  const v = validateOutput(c);
  ok(v.ok, `every adapter output is a valid contract (${c.kind}/${c.id}): ${v.problems.join(", ")}`);
  ok(!!c.whatCouldBeWrong, `every output states what could be wrong (${c.kind})`);
  if (c.decision) {
    decided++;
    ok(c.trust.ok, `a DECISION only ships when TRUST holds (${c.kind})`);
    ok(c.economicImpactRs !== undefined && c.economicImpactRs !== null, `a DECISION always sizes its ₹ impact (${c.kind})`);
    ok(!!c.secondOrder, `a DECISION always states a second-order effect (${c.kind})`);
  } else {
    held++;
    ok(!c.trust.ok, `no decision => TRUST failed / HOLD (${c.kind})`);
    ok(!c.action, `a HOLD carries no action (${c.kind})`);
  }
}
ok(decided >= 3, "the golden set exercises several real DECISIONS");
ok(held >= 2, "the golden set exercises several real HOLDs");

// The law directly: a decision welded onto a failed-trust output is always rejected.
const illegal: OutputContract = { id: "x", kind: "test", data: { summary: "s", source: "m" }, trust: { ok: false, tier: "UNKNOWN", reason: "thin" }, decision: { call: "Kill", why: "vibes" }, confidence: "low", whatCouldBeWrong: "everything" };
ok(!validateOutput(illegal).ok, "law holds universally: no decision without trust");

console.log(`check-contract-invariants: ${pass} assertions passed (${decided} decisions, ${held} holds).`);
