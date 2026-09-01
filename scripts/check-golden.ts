// Golden-account regression net (charter §76/§77): a small set of representative accounts with the
// conclusion a senior media buyer would expect. It asserts ROBUST invariants (winner vs loser, judgeable vs
// insufficient, waste present vs absent), NOT exact score values - so it survives calibration but catches a
// change that flips a decision. This is also the SHADOW-COMPARE baseline for the P1-4 account-relative
// benchmark swap: after that change, every invariant here must still hold, or the change is not safe.
// Run: node --experimental-strip-types scripts/check-golden.ts
import assert from "node:assert/strict";
import { toCockpitInputs, type RealAd } from "../lib/scoring.ts";
import { analyzeAccount } from "../lib/cockpit/analyze.ts";
import { judge } from "../lib/judgment/engine.ts";
import type { MetricsRow } from "../lib/ad-source.ts";

function row(date: string, spend: number, revenue: number, purchases: number, impressions: number, clicks: number, frequency: number): MetricsRow {
  return { adExternalId: "x", date, spend, impressions, clicks, purchases, revenue, frequency };
}
// N consecutive settled days (dated in the past so none are dropped as still-attributing) of identical economics.
function days(n: number, spend: number, revenue: number, purchases: number, impressions: number, clicks: number, frequency: number): MetricsRow[] {
  return Array.from({ length: n }, (_, i) => row(`2026-07-${String(i + 1).padStart(2, "0")}`, spend, revenue, purchases, impressions, clicks, frequency));
}

let pass = 0;
const ok = (c: boolean, m: string) => { if (!c) throw new Error("GOLDEN FAIL: " + m); pass++; };

// --- A. Healthy winner: 5x ROAS, ~120 purchases, stable, low frequency. Expect: high health, no waste, scalable. ---
const winner = toCockpitInputs([{ externalId: "win", name: "Winner", objective: "conversion", rows: days(10, 1000, 5000, 12, 8000, 160, 1.4) }]);
const winnerView = analyzeAccount(winner, "LIVE");
ok(winner[0].wastedRs === 0, "A: a 5x-ROAS ad is not wasted spend");
ok(winnerView.accountHealth.score >= 60, `A: healthy winner account scores >=60 (got ${winnerView.accountHealth.score})`);
ok(judge({ id: "win", name: "Winner", platform: "Meta", objective: "conversion", spend: 10000, adSetSpend: 12000, conversions: 120, clicks: 1600, impressions: 80000, daysDelivered: 10, settledDays: 9, metricVsMedian: 1.6, fatigueState: "fresh", fatigueTrajectory: "improving", fatigueSufficiency: "ok" }).verdict === "SCALE", "A: the winner judges SCALE");

// --- B. True bleed: 0.5x ROAS, ~80 purchases. Expect: waste flagged, lower health than the winner. ---
const bleed = toCockpitInputs([{ externalId: "bleed", name: "Bleeder", objective: "conversion", rows: days(10, 1000, 500, 8, 20000, 300, 3.0) }]);
const bleedView = analyzeAccount(bleed, "LIVE");
ok(bleed[0].wastedRs > 0, "B: a below-1-ROAS conversion ad is flagged as wasted spend");
ok(bleedView.accountHealth.score < winnerView.accountHealth.score, "B: a bleeding account is less healthy than a winning one");

// --- C. High ROAS on a TINY sample: 15x but only 2 purchases. Expect: NOT a trustworthy winner (§20/§92). ---
const fluke = judge({ id: "fluke", name: "Fluke", platform: "Meta", objective: "conversion", spend: 300, adSetSpend: 10000, conversions: 2, clicks: 40, impressions: 3000, daysDelivered: 3, settledDays: 2, metricVsMedian: 3.0, fatigueState: "fresh", fatigueTrajectory: "improving", fatigueSufficiency: "low" });
ok(!fluke.evidence.judgeable && fluke.verdict === "INSUFFICIENT", "C: a 15x-ROAS/2-purchase ad is INSUFFICIENT, never a winner");

// --- D. Awareness ad with a real reach base (60k impr). Expect: judgeable (post 1M->50k floor fix). ---
const aware = judge({ id: "aw", name: "Aware", platform: "Meta", objective: "awareness", spend: 4000, adSetSpend: 10000, conversions: 0, clicks: 300, impressions: 60000, daysDelivered: 8, settledDays: 6, metricVsMedian: 1.0, fatigueState: "fresh", fatigueTrajectory: "steady", fatigueSufficiency: "ok" });
ok(aware.evidence.judgeable, "D: an awareness ad with 60k impressions is judgeable");

// --- E. Mixed account rolls up sanely: winner + bleeder together -> health between the two extremes, waste > 0. ---
const mixed = analyzeAccount(toCockpitInputs([
  { externalId: "win", name: "Winner", objective: "conversion", rows: days(10, 1000, 5000, 12, 8000, 160, 1.4) },
  { externalId: "bleed", name: "Bleeder", objective: "conversion", rows: days(10, 1000, 500, 8, 20000, 300, 3.0) },
]), "LIVE");
ok(mixed.accountHealth.score > bleedView.accountHealth.score && mixed.accountHealth.score < winnerView.accountHealth.score, "E: a mixed account sits between its winner-only and bleeder-only health");
ok(mixed.leaderboard.length === 2, "E: both ads surface in the leaderboard");

console.log(`PASS: golden-account net (${pass} invariants). These are the shadow-compare baseline for scoring changes.`);
