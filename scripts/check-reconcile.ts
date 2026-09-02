// Proof for the reconciliation engine (§6/§93): match / minor-drift / conflict verdict, symmetric scale-free
// drift, and a summary that calls the account untrustworthy if ANY metric conflicts.
// Run: node --experimental-strip-types scripts/check-reconcile.ts

import assert from "node:assert/strict";
import { reconcile, reconSummary } from "../lib/intelligence/reconcile.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// match: within 1%.
const m = reconcile("spend", 100000, 100500, "AdBrain store", "Meta live");
ok(m.status === "match" && m.confidencePenalty === 0, "0.5% apart = match, no penalty");

// minor drift: 1-5%.
const d = reconcile("revenue", 100000, 103000, "AdBrain", "Meta");
ok(d.status === "minor_drift" && d.confidencePenalty === 1, "3% apart = minor drift, one tier down");

// conflict: >= 5%.
const c = reconcile("roas", 3.0, 2.4, "AdBrain", "Meta");
ok(c.status === "conflict" && c.confidencePenalty === 2, "20% apart = conflict, two tiers / HOLD");
ok(/CONFLICTS/.test(c.note) && /reconcile the definitions/.test(c.note), "conflict note says do not trust + reconcile definitions (§129)");

// symmetric + scale-free: order of a,b doesn't change the drift.
ok(reconcile("x", 2.4, 3.0, "A", "B").driftPct === reconcile("x", 3.0, 2.4, "A", "B").driftPct, "drift is symmetric");

// both zero = match; one zero = conflict.
ok(reconcile("spend", 0, 0, "A", "B").status === "match", "0 vs 0 = match");
ok(reconcile("spend", 0, 5000, "A", "B").status === "conflict", "0 vs 5000 = conflict");

// summary: any conflict -> untrustworthy.
const s = reconSummary([m, d, c]);
ok(s.checked === 3 && s.matches === 1 && s.drifts === 1 && s.conflicts === 1, "summary counts each status");
ok(s.trustworthy === false, "any conflict -> account data not trustworthy");
ok(reconSummary([m, d]).trustworthy === true, "no conflict -> trustworthy");

console.log(`check-reconcile: ${pass} assertions passed.`);
