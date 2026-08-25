// Runnable check for lib/rules/change-log.ts (J8 change-log attribution). No I/O, no deps.
//   node --experimental-strip-types scripts/check-change-log.ts
import { strict as assert } from "node:assert";
import {
  changeVolatility,
  learningPenalty,
  attributeDrop,
  LEARNING_FIX,
  type DayPerf,
} from "../lib/rules/change-log.ts";

const buyer = (type: string): DayPerf["changes"][number] => ({ date: "d", source: "buyer", type });
const algo = (type: string): DayPerf["changes"][number] => ({ date: "d", source: "algo", type });

// changeVolatility counts only buyer changes, ignoring algo events.
const mixed: DayPerf = {
  date: "2026-08-01",
  changes: [buyer("pause"), buyer("budget"), algo("reallocation"), algo("learning")],
  perfDeltaPoints: 0,
};
assert.equal(changeVolatility(mixed), 2, "changeVolatility must count only buyer changes");

// learningPenalty counts days with buyer volatility >= 4.
const penaltyDays: DayPerf[] = [
  { date: "2026-08-01", changes: [buyer("a"), buyer("b"), buyer("c"), buyer("d")], perfDeltaPoints: 0 }, // 4 -> counts
  { date: "2026-08-02", changes: [buyer("a"), buyer("b"), buyer("c")], perfDeltaPoints: 0 }, // 3 -> no
  { date: "2026-08-03", changes: [buyer("a"), buyer("b"), buyer("c"), buyer("d"), buyer("e"), algo("x")], perfDeltaPoints: 0 }, // 5 buyer -> counts
];
assert.equal(learningPenalty(penaltyDays), 2, "learningPenalty must count the >= 4 buyer-change days");

// Fixture: a day with 5 buyer changes followed by a -3-point drop → "buyer" (prior-day reset).
const buyerCase = attributeDrop([
  { date: "2026-08-10", changes: [buyer("a"), buyer("b"), buyer("c"), buyer("d"), buyer("e")], perfDeltaPoints: 0 },
  { date: "2026-08-11", changes: [], perfDeltaPoints: -3 },
]);
assert.equal(buyerCase.status, "ok");
if (buyerCase.status === "ok") {
  assert.equal(buyerCase.attributions.length, 1, "only the -3 drop day is attributed");
  assert.equal(buyerCase.attributions[0].cause, "buyer", "5 buyer changes then -3 -> buyer");
}

// Fixture: a day with 0 changes and a -3 move → "algo".
const algoCase = attributeDrop([{ date: "2026-08-12", changes: [], perfDeltaPoints: -3 }]);
assert.equal(algoCase.status, "ok");
if (algoCase.status === "ok") {
  assert.equal(algoCase.attributions[0].cause, "algo", "0 changes and -3 move -> algo");
}

// Fixture: a day with 1 buyer change and a -3 drop → "creative".
const creativeCase = attributeDrop([
  { date: "2026-08-13", changes: [buyer("offer")], perfDeltaPoints: -3 },
]);
assert.equal(creativeCase.status, "ok");
if (creativeCase.status === "ok") {
  assert.equal(creativeCase.attributions[0].cause, "creative", "1 buyer change and -3 -> creative");
}

// Empty → insufficient_data (never a fabricated verdict).
assert.equal(attributeDrop([]).status, "insufficient_data", "empty days -> insufficient_data");

// The learning fix is a note, not an action.
assert.ok(LEARNING_FIX.includes("72h"), "LEARNING_FIX names the 72h freeze");

console.log("PASS: change-log attribution checks");
