// Proof for the learning loop core (§112/§114): polarity + noise-floor direction; ONLY keep-spending calls
// are gradeable (pause/refresh -> null, never a win/loss); below MIN_SAMPLE the hit-rate is withheld.
// Run: node --experimental-strip-types scripts/check-outcome.ts

import assert from "node:assert/strict";
import { actualDirection, evaluate, accuracyStats, gradeableFor, MIN_SAMPLE, type Prediction, type Evaluation } from "../lib/intelligence/outcome.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// direction honours polarity + noise floor.
ok(actualDirection({ before: 2.0, after: 1.4, higherIsBetter: true }) === "worsen", "ROAS 2.0->1.4 = worsen");
ok(actualDirection({ before: 500, after: 700, higherIsBetter: false }) === "worsen", "CPA 500->700 = worsen");
ok(actualDirection({ before: 2.0, after: 2.02, higherIsBetter: true }) === "stable", "1% move = stable (noise floor)");
ok(actualDirection({ before: 0, after: 5, higherIsBetter: true }) === "stable", "no denominator = stable");

// gradeability: only keep-spending calls.
ok(gradeableFor("scale") && gradeableFor("hold") && gradeableFor("continue"), "keep-spending calls are gradeable");
ok(!gradeableFor("pause") && !gradeableFor("refresh") && !gradeableFor("unknown"), "pause/refresh/unknown NOT gradeable");

const p = (o: Partial<Prediction>): Prediction => ({ id: "v1", kind: "winner", metric: "roas", predicted: "improve", confidence: "high", gradeable: true, ...o });

// a correct keep-spending call: predicted improve, it improved.
const good = evaluate(p({}), { before: 2.0, after: 2.6, higherIsBetter: true });
ok(good.correct === true && good.actual === "improve", "scale call that improved = correct");

// a wrong keep-spending call: predicted improve, it worsened.
const bad = evaluate(p({}), { before: 2.0, after: 1.3, higherIsBetter: true });
ok(bad.correct === false, "scale call that worsened = wrong");

// a not-gradeable call (pause/refresh) -> correct null, excluded from accuracy.
const ng = evaluate(p({ gradeable: false, predicted: "worsen" }), { before: 2.0, after: 1.3, higherIsBetter: true });
ok(ng.correct === null, "not-gradeable -> null (never a win or loss)");

// MIN_SAMPLE gate: a handful of calls -> hitRate withheld.
const few: Evaluation[] = [good, bad, ng];
const sFew = accuracyStats(few);
ok(sFew.n === 2 && sFew.trustworthy === false && sFew.hitRate === null, "below MIN_SAMPLE -> hitRate withheld (null), only gradeable counted");

// enough calls -> a real hit-rate.
const many: Evaluation[] = [];
for (let i = 0; i < MIN_SAMPLE; i++) many.push(evaluate(p({}), { before: 2, after: 2.6, higherIsBetter: true })); // all correct
const sMany = accuracyStats(many);
ok(sMany.trustworthy && sMany.hitRate === 1, "at MIN_SAMPLE -> a real hit-rate");
ok(sMany.byKind.winner.n === MIN_SAMPLE, "per-kind rollup counts");

console.log(`check-outcome: ${pass} assertions passed.`);
