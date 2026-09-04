// Runnable check for lib/cockpit/analyze.ts (the integration seam) + the sample
// account. Run: node --experimental-strip-types scripts/check-cockpit.ts
import assert from "node:assert/strict";
import { analyzeAccount, type CockpitAdInput } from "../lib/cockpit/analyze.ts";
import { SCALE_LABEL, reconcileScaleWithSaturation } from "../lib/cockpit/actions.ts";
import { SAMPLE_ADS } from "../lib/sample/account.ts";

// --- Deterministic mini-fixture: one winner, one diagnosed loser. ---
const winner: CockpitAdInput = {
  id: "w", name: "Winner", objective: "conversion",
  performance: 90, trend: 85, fatigue: 20, funnel: 82,
  conversions: 200, days: 30, stable: true, roomToScale: true,
  spendRs: 100000, revenueRs: 500000, wastedRs: 0,
};
const loser: CockpitAdInput = {
  id: "l", name: "Loser", objective: "conversion",
  performance: 20, trend: 15, fatigue: 82, funnel: 44,
  conversions: 120, days: 20, stable: false, roomToScale: false,
  spendRs: 50000, revenueRs: 40000, wastedRs: 30000,
  diagnosis: { status: "ok", cause: "creative_fatigue", rung: 7, severity: "red",
    ruledOut: ["measurement", "tracking_attribution", "auction_cpm", "landing_checkout", "stock_out", "audience_saturation", "change_volatility"], note: "worn" },
};

const view = analyzeAccount([loser, winner]); // deliberately unsorted input

// Leaderboard is sorted best-first by CreativeScore.
assert.equal(view.leaderboard[0].id, "w", "winner leads the leaderboard");
assert.equal(view.leaderboard[0].verdict, "winner");
assert.equal(view.leaderboard[1].verdict, "loser");

// The loser becomes a DO_NOW "Kill" action; the do-this queue is priority-sorted.
assert.equal(view.doThis[0].priority, "DO_NOW", "most urgent action first");
assert.ok(view.doThis[0].label.includes("Kill"));

// ROAS is computed, never fabricated; totals add up.
assert.equal(view.totals.spendRs, 150000);
assert.equal(view.totals.roas, 540000 / 150000);
assert.equal(view.leaderboard[0].roas, 5, "winner ROAS = 500000/100000");

// Waste rolls up and account health is a bounded MODEL_ESTIMATE.
assert.equal(view.waste.status, "ok");
if (view.waste.status === "ok") assert.equal(view.waste.totalWastedRs, 30000);
assert.ok(view.accountHealth.score >= 0 && view.accountHealth.score <= 100);
assert.equal(view.accountHealth.factLabel, "MODEL_ESTIMATE");

// Zero-spend ad yields null ROAS, not a divide-by-zero number.
const zero = analyzeAccount([{ ...winner, id: "z", spendRs: 0, revenueRs: 0, wastedRs: 0 }]);
assert.equal(zero.leaderboard[0].roas, null);

// --- The real sample account analyzes cleanly and tells the intended story. ---
const sample = analyzeAccount(SAMPLE_ADS);
assert.equal(sample.dataSource, "SAMPLE", "sample must be labelled SAMPLE, never LIVE");
const byId = Object.fromEntries(sample.leaderboard.map((a) => [a.id, a]));
assert.equal(byId["ad_hero_ugc"].verdict, "winner", "hero UGC is the winner");
assert.equal(byId["ad_carousel_sale"].verdict, "loser", "faded sale carousel is the loser");
assert.equal(byId["ad_reels_demo"].verdict, "do_not_kill_yet", "CPM-hit reels: do not kill");
assert.ok(byId["ad_reels_demo"].action.label.toLowerCase().includes("auction cpm"), "action names the real cause");
assert.equal(byId["ad_static_offer"].verdict, "refresh", "worn-but-converting static: refresh");
assert.notEqual(byId["ad_new_angle"].verdict, "winner", "6-purchase ad is not a winner (coin-toss guard)");

// --- Per-account weight override threads all the way into the produced view (not just the pure
// function). This is the integration proof for the Settings "Verdict weights" panel: the cookie ->
// fetchLiveCockpit -> analyzeAccount -> verdict -> creativeScore path changes real leaderboard rows.
const scoreOf = (v: ReturnType<typeof analyzeAccount>) => v.leaderboard[0].why.find((w) => w.startsWith("CreativeScore"));
const defaultScore = scoreOf(analyzeAccount([winner])); // default weights -> 0.3/0.3/0.2/0.2
const perfScore = scoreOf(analyzeAccount([winner], "SAMPLE", { performance: 1, trend: 0, fatigue: 0, funnel: 0 }));
assert.ok(defaultScore?.includes("84.9"), `default weights -> CreativeScore 84.9, got ${defaultScore}`);
assert.ok(perfScore?.includes("90.0"), `all-performance weight -> CreativeScore = performance (90.0), got ${perfScore}`);
assert.notEqual(defaultScore, perfScore, "custom weights actually change the CreativeScore in the rendered leaderboard row");

// --- reconcileScaleWithSaturation: a per-ad SCALE call must defer to the account diminishing-returns read ---
const scaleView = analyzeAccount([winner]);
assert.equal(scaleView.leaderboard[0].action.label, SCALE_LABEL, "winner with room to scale -> Scale the budget");
// HEALTHY / UNDERFUNDED / UNKNOWN: adding budget is still the right (or unproven) call -> scale unchanged.
for (const c of ["HEALTHY", "UNDERFUNDED", "UNKNOWN"] as const) {
  assert.equal(reconcileScaleWithSaturation(scaleView, c).leaderboard[0].action.label, SCALE_LABEL, `${c} -> scale unchanged`);
}
// SATURATED: reframe as reallocation, and it must propagate to the do-now queue too (not just the leaderboard).
const sat = reconcileScaleWithSaturation(scaleView, "SATURATED");
assert.equal(sat.leaderboard[0].action.label, "Scale by reallocation only", "saturated -> scale becomes reallocation");
const satQueue = sat.doThis.find((d) => d.adId === "w");
assert.ok(satQueue && satQueue.label === "Scale by reallocation only", "reframe propagates to the do-now queue");
// APPROACHING_SATURATION: hold total budget framing.
assert.ok(reconcileScaleWithSaturation(scaleView, "APPROACHING_SATURATION").leaderboard[0].action.label.startsWith("Scale by reallocation - hold"), "approaching saturation -> hold total budget");
// A non-scale action (the loser's Kill) must never be rewritten.
const mixed = reconcileScaleWithSaturation(analyzeAccount([winner, loser]), "SATURATED");
const loserRow = mixed.leaderboard.find((a) => a.id === "l");
assert.ok(loserRow && loserRow.action.label !== "Scale by reallocation only" && !loserRow.action.label.startsWith("Scale by reallocation"), "non-scale actions untouched");

console.log("PASS: cockpit analyze + sample account + scale-saturation reconcile checks");
