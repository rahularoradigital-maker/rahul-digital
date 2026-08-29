// Runnable check for objective-aware scoring (lib/rules/objective-metrics.ts + the judge in
// lib/cockpit/analyze.ts). No framework: plain asserts. Proves a verdict is read on the campaign
// OBJECTIVE's own metric family, so an awareness ad is not killed for a 0 ROAS it never chased,
// while a conversion ad still is when its sales metrics collapse.
// Run: node --experimental-strip-types scripts/check-objective-scoring.ts
import assert from "node:assert/strict";
import { analyzeAccount, type CockpitAdInput } from "../lib/cockpit/analyze.ts";
import { objectiveFamily, objectiveReason } from "../lib/rules/objective-metrics.ts";
import type { FatigueRead } from "../lib/scoring/fatigue.ts";

// --- Family mapping: every Objective is classified; conversion + unknown default to "sales". ---
assert.equal(objectiveFamily("conversion"), "sales", "conversion is a sales objective");
assert.equal(objectiveFamily("awareness"), "awareness");
assert.equal(objectiveFamily("engagement"), "awareness");
assert.equal(objectiveFamily("traffic"), "awareness");
assert.equal(objectiveFamily("leads"), "awareness", "leads carry no ROAS: not a sales judgement");
assert.equal(objectiveFamily("app_installs"), "awareness");
assert.ok(/not ROAS/i.test(objectiveReason("awareness")), "awareness reason names the read, not ROAS");

// A fresh, healthy day-wise read so the decision engine has a real trajectory to act on.
const freshRead: FatigueRead = {
  sufficiency: "ok", windowDays: 21, index: 20, state: "fresh", trajectory: "stable",
  signals: { frequency: 20, ctrDecay: 10, cpmRise: 10 }, daysToFatigue: null, evidence: ["CTR steady."],
};

// 1) AWARENESS ad with 0 ROAS but healthy CPM/CTR (high healthScore) is NOT a loser/kill.
const awareness: CockpitAdInput = {
  id: "aw", name: "Brand awareness", objective: "awareness",
  performance: 80, trend: 55, fatigue: 20, funnel: 70,
  conversions: 0, days: 21, stable: true, roomToScale: true,
  healthScore: 82, // healthy CTR + freshness; ROAS is 0 by design
  fatigueRead: freshRead,
  spendRs: 40000, revenueRs: 0, wastedRs: 0,
};
const aw = analyzeAccount([awareness], "LIVE").leaderboard[0];
assert.notEqual(aw.verdict, "loser", "awareness ad with 0 ROAS but healthy CTR must not be a loser");
assert.ok(!aw.action.label.toLowerCase().includes("kill"), "awareness ad must not be told to Kill for 0 ROAS");
assert.ok(aw.why.some((w) => /not ROAS/i.test(w)), "why names the objective-appropriate read, not ROAS");

// 2) A SALES (conversion) ad with 0 ROAS + real spend + diagnosed creative fatigue IS a loser/kill.
const sales: CockpitAdInput = {
  id: "sa", name: "Catalog sale", objective: "conversion",
  performance: 15, trend: 12, fatigue: 85, funnel: 40,
  conversions: 80, days: 21, stable: false, roomToScale: false,
  spendRs: 50000, revenueRs: 0, wastedRs: 50000,
  diagnosis: {
    status: "ok", cause: "creative_fatigue", rung: 7, severity: "red",
    ruledOut: ["measurement", "tracking_attribution", "auction_cpm", "landing_checkout", "stock_out", "audience_saturation", "change_volatility"],
    note: "worn",
  },
};
const sa = analyzeAccount([sales], "LIVE").leaderboard[0];
assert.equal(sa.verdict, "loser", "conversion ad with 0 ROAS + spend + creative fatigue is still a loser");
assert.ok(sa.action.label.toLowerCase().includes("kill"), "conversion loser is a Kill action");

// 3) No fabrication: an awareness ad whose objective metric is n/a (healthScore null) holds.
const awNa: CockpitAdInput = { ...awareness, id: "awna", healthScore: null };
const na = analyzeAccount([awNa], "LIVE").leaderboard[0];
assert.notEqual(na.verdict, "loser", "n/a objective metric must not be a loser");
assert.ok(na.why.some((w) => /hold/i.test(w)), "n/a objective metric degrades to hold, never invents a read");

console.log("PASS: objective-aware scoring checks");
