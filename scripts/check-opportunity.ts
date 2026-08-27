// One runnable check for the opportunity loss engine. No frameworks, no fixtures.
// Run: node --experimental-strip-types scripts/check-opportunity.ts
import assert from "node:assert/strict";
import { opportunityLoss } from "../lib/scoring/opportunity.ts";
import type { CockpitAd } from "../lib/cockpit/analyze.ts";
import type { FatigueRead } from "../lib/scoring/fatigue.ts";

function fatigue(state: FatigueRead["state"]): FatigueRead {
  return {
    sufficiency: "ok",
    windowDays: 14,
    index: 80,
    state,
    trajectory: "worsening",
    signals: { frequency: 80, ctrDecay: 80, cpmRise: 60 },
    daysToFatigue: 3,
    evidence: ["day-wise decay"],
  };
}

function ad(over: Partial<CockpitAd>): CockpitAd {
  return {
    id: "x",
    name: "x",
    objective: "conversion",
    spendRs: 0,
    revenueRs: 0,
    roas: null,
    verdict: "do_not_kill_yet",
    score: 50,
    confidence: 0.5,
    why: [],
    action: { label: "Hold", priority: "WATCH", why: "" },
    wastedRs: 0,
    ...over,
  };
}

// A wasted loser, a fatiguing ad, and a winner with room to scale.
const loser = ad({ id: "loser", verdict: "loser", spendRs: 1000, revenueRs: 200, roas: 0.2, wastedRs: 800 });
const fatiguing = ad({ id: "fat", verdict: "refresh", spendRs: 500, revenueRs: 600, roas: 1.2, wastedRs: 0, fatigueRead: fatigue("fatiguing") });
const winner = ad({ id: "win", verdict: "winner", spendRs: 300, revenueRs: 1500, roas: 5, wastedRs: 0 });

const r = opportunityLoss([loser, fatiguing, winner]);

// wastedRs = sum of per-ad wastedRs = 800.
assert.equal(r.wastedRs, 800);
// atRiskRs = spend on fatiguing/fatigued ads = 500.
assert.equal(r.atRiskRs, 500);
// underScaledRs = spend on winners = 300 (proxy).
assert.equal(r.underScaledRs, 300);
// totalLossRs = wasted + atRisk = 1300.
assert.equal(r.totalLossRs, 1300);
// lossShare = 1300 / (1000 + 500 + 300) = 1300 / 1800.
assert.equal(r.lossShare, 1300 / 1800);
// drivers: non-zero components sorted desc -> wasted (800) then at-risk (500).
assert.deepEqual(
  r.drivers.map((d) => d.rs),
  [800, 500],
);
assert.equal(r.drivers[0].label, "Wasted spend");

// A "fatigued" ad also counts as at-risk.
const fatigued = ad({ id: "fd", spendRs: 250, wastedRs: 0, fatigueRead: fatigue("fatigued") });
assert.equal(opportunityLoss([fatigued]).atRiskRs, 250);

// Zero-spend input yields lossShare 0, not NaN.
const empty = opportunityLoss([]);
assert.equal(empty.lossShare, 0);
assert.ok(!Number.isNaN(empty.lossShare));
assert.equal(empty.totalLossRs, 0);
assert.deepEqual(empty.drivers, []);

// A single zero-everything ad: still 0, still no NaN.
const zero = opportunityLoss([ad({ spendRs: 0, wastedRs: 0 })]);
assert.equal(zero.lossShare, 0);
assert.ok(!Number.isNaN(zero.lossShare));

console.log("PASS: opportunity loss checks");
