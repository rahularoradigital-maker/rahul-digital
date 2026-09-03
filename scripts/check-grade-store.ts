// Proof for the outcome grader (§112): a stored decision_triples row + the ad's current ROAS -> a graded
// outcome; keep-spending calls are gradeable, fixes are warnings; no baseline / no current metric -> skipped;
// accuracy rolls up. Run: node --experimental-strip-types scripts/check-grade-store.ts

import assert from "node:assert/strict";
import { rowToPrediction, gradeRows, type DecisionTripleRow } from "../lib/intelligence/grade-store.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const row = (adId: string, action: string, roas: number | null, conf = 0.8): DecisionTripleRow => ({
  ad_id: adId, snapshot_day: "2026-08-20", rule_id: "verdict",
  situation: { roas, confidence: conf }, recommendation: { action },
});

// a scale call is gradeable, predicts stable, baseline = situation.roas.
const p = rowToPrediction(row("a", "Scale", 3.0))!;
ok(p.prediction.gradeable && p.prediction.predicted === "stable" && p.before === 3.0, "scale row -> gradeable, baseline 3.0");

// a refresh is a warning (not gradeable).
ok(rowToPrediction(row("b", "Refresh", 2.0))!.prediction.gradeable === false, "refresh row -> not gradeable");

// no baseline ROAS -> null (nothing to grade).
ok(rowToPrediction(row("c", "Scale", null)) === null, "no baseline roas -> no prediction");

// grade a batch: 'a' scaled at 3.0 and is now 3.1 (stable, within floor) -> correct; a row with no current
// metric is skipped.
const rows = [row("a", "Scale", 3.0), row("b", "Refresh", 2.0), row("c", "Scale", null)];
const g = gradeRows(rows, { a: 3.05, b: 1.2 /* refresh: not gradeable */, c: 9 });
ok(g.writes.length === 2, "two gradeable-eligible rows produced outcomes (a + b); c has no baseline");
const aw = g.writes.find((w) => w.adId === "a")!;
ok(aw.outcome.before === 3.0 && aw.outcome.after === 3.05 && aw.outcome.correct === true, "scale held near 3.0 -> correct outcome persisted");
const bw = g.writes.find((w) => w.adId === "b")!;
ok(bw.outcome.correct === null, "a not-gradeable refresh -> outcome recorded but correct=null");
ok(g.accuracy.n === 1, "accuracy counts only the 1 gradeable eval (a)");

// no current metric at all -> nothing graded.
ok(gradeRows([row("a", "Scale", 3.0)], {}).writes.length === 0, "no current metric -> skipped, never fabricated");

console.log(`check-grade-store: ${pass} assertions passed.`);
