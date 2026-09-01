// Proof that the money-bleed adapter maps a real CulpritDiagnosis into a valid §110 Output Contract, and that
// the chain's law holds on live-shaped data: a real drop with a stopped cause -> a decided contract carrying
// its ₹ impact + diagnosis + second-order; a drop with no cause -> HOLD; no drop -> nothing to surface.
// Run: node --experimental-strip-types scripts/check-culprit-contract.ts

import assert from "node:assert/strict";
import type { CulpritDiagnosis } from "../lib/scoring/culprit.ts";
import { culpritToContract } from "../lib/intelligence/from-culprit.ts";
import { validateOutput } from "../lib/intelligence/output-contract.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// 1) No material drop -> nothing to surface (null).
const stable: CulpritDiagnosis = { dropped: false, metric: "revenue", dropPct: 0.03, recentRs: 97000, priorRs: 100000, culprits: [], summary: null };
ok(culpritToContract(stable, { entityId: "acc1" }) === null, "no drop -> null (no card)");

// 2) Real drop + a stopped culprit -> a valid decided contract with the right ₹ impact.
const dropped: CulpritDiagnosis = {
  dropped: true, metric: "revenue", dropPct: 0.42, recentRs: 58000, priorRs: 100000,
  culprits: [{ id: "c1", name: "Diwali Sale | Conversions", priorSpendRs: 60000, recentSpendRs: 0, stoppedOn: "2026-08-20", shareOfPrior: 0.61 }],
  summary: "Revenue fell 42% ...",
};
const c = culpritToContract(dropped, { entityId: "acc1" });
ok(c !== null && c.decision !== null, "real drop + culprit -> a decision");
ok(validateOutput(c!).ok, "the mapped contract is valid (full reasoning chain)");
ok(c!.economicImpactRs === 42000, "economic impact = priorRs - recentRs (100000-58000)");
ok(c!.entity?.name === "Diwali Sale | Conversions", "the paused culprit is named as the CAUSE");
ok(/do NOT try to "fix" the paused/.test(c!.action ?? ""), "action does not point at fixing the paused entity (liveness rule)");
ok(c!.confidence === "high", "single material culprit -> high confidence");

// 3) Real drop but NO single material cause -> HOLD (refuse to pin a cause).
const noCause: CulpritDiagnosis = { dropped: true, metric: "spend", dropPct: 0.25, recentRs: 75000, priorRs: 100000, culprits: [], summary: null };
const h = culpritToContract(noCause, { entityId: "acc1" });
ok(h !== null && h.trust.ok === false && h.decision === null, "drop with no cause -> HOLD, no decision");
ok(validateOutput(h!).ok, "the HOLD is a valid contract");

// 4) Two culprits -> medium confidence (less certain which one).
const two: CulpritDiagnosis = {
  dropped: true, metric: "revenue", dropPct: 0.30, recentRs: 70000, priorRs: 100000,
  culprits: [
    { id: "c1", name: "A", priorSpendRs: 30000, recentSpendRs: 0, stoppedOn: null, shareOfPrior: 0.3 },
    { id: "c2", name: "B", priorSpendRs: 25000, recentSpendRs: 0, stoppedOn: null, shareOfPrior: 0.25 },
  ],
  summary: null,
};
ok(culpritToContract(two, { entityId: "acc1" })!.confidence === "med", "two culprits -> medium confidence");

console.log(`check-culprit-contract: ${pass} assertions passed.`);
