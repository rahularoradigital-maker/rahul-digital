// Runnable check for lib/rules/account.ts + lib/rules/production.ts. No env needed.
//   node --experimental-strip-types scripts/check-account.ts
import { strict as assert } from "node:assert";
import {
  budgetConcentration,
  trappedBudget,
  scalingHeadroom,
  wasteRollup,
} from "../lib/rules/account.ts";
import type { AdSummary } from "../lib/rules/account.ts";
import { replacementRequirement, productionPriorities } from "../lib/rules/production.ts";
import type { ProductionGap } from "../lib/rules/production.ts";

const close = (a: number, b: number) => Math.abs(a - b) < 1e-12;

// Collect every numeric leaf in an object as "path=value" strings.
function numericLeaves(obj: unknown, path = ""): string[] {
  if (typeof obj === "number") return [`${path}=${obj}`];
  if (obj === null || typeof obj !== "object") return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    numericLeaves(v, path ? `${path}.${k}` : k),
  );
}

// Fixture: 5 ads, total spend 1000. Shares are hand-computed below.
const ads: AdSummary[] = [
  { adId: "a1", spend: 500, revenue: 1000, fatigueIndex: 0.9, conceptId: "c1" }, // roas 2, fatigued
  { adId: "a2", spend: 250, revenue: 1250, fatigueIndex: null, conceptId: "c2" }, // roas 5, UNASSESSED
  { adId: "a3", spend: 125, revenue: 750, fatigueIndex: 0.2, conceptId: "c1" }, // roas 6, healthy
  { adId: "a4", spend: 75, revenue: 75, fatigueIndex: 0.8 }, // roas 1, fatigued
  { adId: "a5", spend: 50, revenue: 50, fatigueIndex: 0.1, conceptId: null }, // roas 1, healthy
];

// --- budgetConcentration: top1 = 500/1000, top3 = 875/1000, top5 = 1000/1000
const conc = budgetConcentration(ads);
assert.equal(conc.status, "ok");
if (conc.status === "ok") {
  assert.equal(conc.top1Share, 0.5, "top1 = 500/1000");
  assert.equal(conc.top3Share, 0.875, "top3 = (500+250+125)/1000");
  assert.equal(conc.top5Share, 1, "top5 = all spend");
  // byConcept: c1 = (500+125)/1000 = 0.625, c2 = 250/1000 = 0.25, sorted desc
  assert.deepEqual(conc.byConcept, [
    { conceptId: "c1", share: 0.625 },
    { conceptId: "c2", share: 0.25 },
  ]);
}

// --- trappedBudget: only ASSESSED-fatigued spend counts; null fatigue is reported
// separately, never trapped. trapped = a1(500) + a4(75); unassessed = a2(250).
const trapped = trappedBudget(ads);
assert.equal(trapped.status, "ok");
if (trapped.status === "ok") {
  assert.equal(trapped.trappedRs, 575, "trapped = 500 + 75 (assessed fatigued only)");
  assert.equal(trapped.unassessedRs, 250, "null fatigue reported apart, not trapped");
  assert.deepEqual(trapped.ads, ["a1", "a4"]);
  assert.ok(trapped.trappedRs + trapped.unassessedRs === 825, "split is disjoint");
}

// --- scalingHeadroom: roas = [2, 5, 6, 1, 1], median 2. Above-median AND healthy:
// a3 only (a2 has roas 5 > 2 but null fatigue = unknown → excluded; a1 fatigued).
const scale = scalingHeadroom(ads);
assert.equal(scale.status, "ok");
if (scale.status === "ok") {
  assert.deepEqual(scale.candidates, [{ adId: "a3", roas: 6 }], "obvious winner only");
  assert.equal(scale.caveat, "MARGINAL_UNKNOWN", "marginal caveat is mandatory");
  assert.equal(scale.nextDollar.status, "insufficient_data");
  assert.match(scale.nextDollar.needs, /spend-response|lift test/);
  // HONESTY: no estimated marginal/elasticity number may exist anywhere in the output.
  const leaves = numericLeaves(scale);
  assert.ok(
    leaves.every((l) => !/marginal|elastic|saturation|nextDollar/i.test(l)),
    `no marginal number allowed, got: ${leaves.join(", ")}`,
  );
  assert.equal(numericLeaves(scale.nextDollar).length, 0, "nextDollar carries no numbers");
}

// --- wasteRollup: 100 + 20 wasted over 1000 spend = 12% of spend.
const rollup = wasteRollup([{ adId: "a1", wastedRs: 100 }, { adId: "a3", wastedRs: 20 }], 1000);
assert.equal(rollup.status, "ok");
if (rollup.status === "ok") {
  assert.equal(rollup.totalWastedRs, 120);
  assert.ok(close(rollup.shareOfSpend, 0.12), "share = 120/1000");
}

// --- replacementRequirement: 20 ads, 0.3 fatigued, 15d survival, 14d horizon.
// Hand-computed: 6 fatigued now + 14 healthy * (14/15) = 13.066... expiries
// → 19.066... → ceil = 20. A fraction of a creative is a whole creative.
const rep = replacementRequirement({
  activeAds: 20,
  fatiguedShare: 0.3,
  medianSurvivalDays: 15,
  horizonDays: 14,
});
assert.equal(rep.status, "ok");
if (rep.status === "ok") {
  assert.equal(rep.creativesNeeded, Math.ceil(6 + 14 * (14 / 15)));
  assert.equal(rep.creativesNeeded, 20);
  assert.equal(rep.factLabel, "MODEL_ESTIMATE", "an estimate, never a fact");
  assert.ok(rep.rationale.length > 0, "must explain itself");
}

// null survival → insufficient_data; NEVER an assumed industry default.
const repNull = replacementRequirement({
  activeAds: 20,
  fatiguedShare: 0.3,
  medianSurvivalDays: null,
  horizonDays: 14,
});
assert.equal(repNull.status, "insufficient_data");
assert.equal(numericLeaves(repNull).length, 0, "insufficient_data carries no numbers");

// --- productionPriorities: impact desc, then urgency, then confidence desc.
const gaps: ProductionGap[] = [
  { kind: "hook", value: "UGC testimonial", expectedImpact: "low", urgency: "now", confidence: 0.9 },
  { kind: "angle", value: "price anchoring", expectedImpact: "high", urgency: "next", confidence: 0.5 },
  { kind: "persona", value: "new-parent", expectedImpact: "high", urgency: "now", confidence: 0.4 },
  { kind: "format", value: "carousel", expectedImpact: "high", urgency: "next", confidence: 0.8 },
];
const briefs = productionPriorities(gaps);
assert.deepEqual(
  briefs.map((b) => b.gap.value),
  ["new-parent", "carousel", "price anchoring", "UGC testimonial"],
  "impact desc, then urgency, then confidence desc",
);
assert.equal(
  briefs[0].brief,
  "Test a new-parent persona (impact: high, urgency: now, confidence: 0.4).",
);
assert.equal(productionPriorities([]).length, 0, "no gaps → no briefs, nothing invented");

// --- empty / zero inputs → insufficient_data with NO numeric fields.
for (const r of [
  budgetConcentration([]),
  budgetConcentration([{ adId: "z", spend: 0, revenue: 0, fatigueIndex: null }]),
  trappedBudget([]),
  scalingHeadroom([]),
  wasteRollup([], 1000),
  wasteRollup([{ adId: "a1", wastedRs: 10 }], 0),
]) {
  assert.equal(r.status, "insufficient_data");
  assert.equal(numericLeaves(r).length, 0, "insufficient_data must carry no numbers");
}

console.log("PASS: account + production intelligence checks");
