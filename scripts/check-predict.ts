// Proof for the contract -> Prediction bridge (§112): scale=gradeable improve, hold=gradeable stable,
// refresh/reallocate=not gradeable (a warning), HOLD=null. Run: node --experimental-strip-types scripts/check-predict.ts

import assert from "node:assert/strict";
import type { OutputContract } from "../lib/intelligence/output-contract.ts";
import { contractToPrediction, contractsToPredictions } from "../lib/intelligence/predict.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const dec = (kind: string, call: string): OutputContract => ({
  id: `${kind}:1`, kind, entity: { level: "ad", id: "a", name: "A" },
  data: { summary: "s", source: "meta-store" }, trust: { ok: true, tier: "CALCULATED", reason: "ok" },
  decision: { call, why: "w" }, economicImpactRs: 5000, confidence: "high", whatCouldBeWrong: "x",
});

// scale -> gradeable, predicts improve, metric roas.
const s = contractToPrediction(dec("winner", "Scale carefully"))!;
ok(s.gradeable && s.predicted === "improve" && s.metric === "roas", "scale -> gradeable improve on roas");

// hold -> gradeable stable.
const h = contractToPrediction(dec("scaling", "Hold budget; line up the next winner"))!;
ok(h.gradeable && h.predicted === "stable", "hold -> gradeable stable");

// refresh -> NOT gradeable (a warning of worsening), metric cpa for bleed / cvr for funnel.
const r = contractToPrediction(dec("fatigue", "Refresh"))!;
ok(!r.gradeable && r.predicted === "worsen", "refresh -> not gradeable, warns worsen");
ok(contractToPrediction(dec("funnel", "Address the landing-page view rate"))!.metric === "cvr", "funnel decision -> cvr metric");
ok(contractToPrediction(dec("money-bleed", "Relaunch or reallocate"))!.metric === "cpa", "bleed decision -> cpa metric");

// a HOLD (no decision) -> null.
const hold: OutputContract = { id: "h", kind: "fatigue", data: { summary: "s", source: "m" }, trust: { ok: false, tier: "UNKNOWN", reason: "thin" }, confidence: "low", whatCouldBeWrong: "wait" };
ok(contractToPrediction(hold) === null, "HOLD -> no prediction");

// batch drops the nulls.
ok(contractsToPredictions([dec("winner", "Scale carefully"), hold]).length === 1, "batch drops non-predictions");

console.log(`check-predict: ${pass} assertions passed.`);
