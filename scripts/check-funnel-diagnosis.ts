// One runnable check for the funnel-diagnosis engine (stage classifier + weakest-step finder). No frameworks.
// Run: node --experimental-strip-types scripts/check-funnel-diagnosis.ts
import assert from "node:assert/strict";
import { classifyStage } from "../lib/funnel/stage.ts";
import { diagnoseFunnel, type FunnelAd } from "../lib/funnel/diagnosis.ts";
import type { ExtendedMetricsRow } from "../lib/metrics/funnel-metrics.ts";

// ---- Stage classifier ----
assert.equal(classifyStage("PURCHASE", "conversion").stage, "BOF");
assert.equal(classifyStage("PURCHASE", "conversion").confidence, 92);
assert.equal(classifyStage("PURCHASE", "conversion").reviewRequired, false);
// Goal and objective disagree -> goal wins, lower confidence, review flagged.
const disagree = classifyStage("LANDING_PAGE_VIEWS", "conversion");
assert.equal(disagree.stage, "MOF");
assert.equal(disagree.confidence, 75);
assert.equal(disagree.reviewRequired, true);
// No goal, unambiguous objective.
assert.deepEqual({ s: classifyStage(null, "awareness").stage, c: classifyStage(null, "awareness").confidence, r: classifyStage(null, "awareness").reviewRequired }, { s: "TOF", c: 80, r: false });
// No goal, arguable objective (traffic) -> lower confidence + review.
const traffic = classifyStage(null, "traffic");
assert.equal(traffic.stage, "MOF");
assert.equal(traffic.confidence, 60);
assert.equal(traffic.reviewRequired, true);
// Unknown goal string falls back to the objective.
assert.equal(classifyStage("SOME_NEW_GOAL", "awareness").source, "objective");

// ---- Weakest-step finder ----
function row(p: Partial<ExtendedMetricsRow>): ExtendedMetricsRow {
  return { date: "2026-08-01", spend: 0, impressions: 0, clicks: 0, outboundClicks: 0, video3sViews: 0, videoThruplays: 0, landingPageViews: 0, addToCarts: 0, initiateCheckouts: 0, purchases: 0, ...p };
}
function ad(adId: string, r: Partial<ExtendedMetricsRow>): FunnelAd {
  return { adId, objective: "conversion", optimizationGoal: "PURCHASE", rows: [row(r)] };
}

// Three same-objective ads. "weak" has a badly low add-to-cart rate (6%) vs the account best (25%).
const best = ad("best", { spend: 100, impressions: 10000, clicks: 500, outboundClicks: 400, landingPageViews: 300, addToCarts: 75, initiateCheckouts: 30, purchases: 15 });
const weak = ad("weak", { spend: 100, impressions: 10000, clicks: 500, outboundClicks: 400, landingPageViews: 300, addToCarts: 18, initiateCheckouts: 9, purchases: 4 });
const third = ad("third", { spend: 100, impressions: 10000, clicks: 500, outboundClicks: 400, landingPageViews: 300, addToCarts: 60, initiateCheckouts: 24, purchases: 12 });

const report = diagnoseFunnel([best, weak, third], { currency: "USD" });
const weakDx = report.ads.find((a) => a.adId === "weak")!;
assert.ok(weakDx, "weak ad diagnosed");
assert.ok(weakDx.leak, "weak ad has a named leak");
assert.equal(weakDx.leak!.key, "lpv_to_atc", "the leak is the add-to-cart step");
assert.ok(weakDx.leak!.gap > 70 && weakDx.leak!.gap < 80, `gap ~76%, got ${weakDx.leak!.gap.toFixed(1)}`);
assert.equal(weakDx.stage.stage, "BOF", "PURCHASE goal -> BOF");

// The account's own best ad on that step has no material leak there.
const bestDx = report.ads.find((a) => a.adId === "best")!;
assert.equal(bestDx.leak, null, "best ad has no leak");
assert.ok(bestDx.hold && /material/i.test(bestDx.hold), "best ad holds on materiality");

// Account verdict: the add-to-cart step carries the leaking spend.
assert.equal(report.verdict.headlineStep, "lpv_to_atc", "verdict names the add-to-cart leak");
assert.ok(report.verdict.leakingAds >= 1);

// Spend floor: an ad at/under the floor is HELD, never scored.
const tiny = ad("tiny", { spend: 3, impressions: 100, clicks: 5, outboundClicks: 4, landingPageViews: 3, addToCarts: 1 });
const withTiny = diagnoseFunnel([best, weak, third, tiny], { currency: "USD" });
assert.ok(withTiny.held.some((h) => h.adId === "tiny"), "tiny-spend ad is held");
assert.ok(!withTiny.ads.some((a) => a.adId === "tiny"), "held ad is not scored");

// Baseline gate: a single same-objective ad cannot be diagnosed (the best ad would be itself).
const lonely: FunnelAd = { adId: "lonely", objective: "leads", optimizationGoal: "LEAD_GENERATION", rows: [row({ spend: 50, impressions: 8000, clicks: 300, outboundClicks: 250, landingPageViews: 200 })] };
const lonelyReport = diagnoseFunnel([lonely], { currency: "USD" });
const lonelyDx = lonelyReport.ads.find((a) => a.adId === "lonely")!;
assert.equal(lonelyDx.leak, null, "single-baseline ad names no leak");
assert.ok(/only 1 ad|need 3/i.test(lonelyDx.hold ?? ""), "hold explains the thin baseline");

// Determinism.
assert.deepEqual(diagnoseFunnel([best, weak, third], { currency: "USD" }), report, "diagnosis is deterministic");

console.log("OK check-funnel-diagnosis: stage classifier + weakest-step finder + spend/baseline/materiality holds verified.");
