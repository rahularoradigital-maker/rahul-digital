// Proof that the action queue only suggests actions on ads that are ACTUALLY DELIVERING - so a paused/ended
// ad (or one whose status we couldn't sync but which stopped spending) never gets a scale/refresh/pause nudge.
// Run: node --experimental-strip-types scripts/check-delivering.ts

import { toCockpitInputs, type RealAd } from "../lib/scoring.ts";
import { analyzeAccount } from "../lib/cockpit/analyze.ts";
import { SAMPLE_ADS } from "../lib/sample/account.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const row = (date: string, spend: number) => ({ adExternalId: "x", date, spend, impressions: spend * 5, clicks: Math.round(spend / 10), purchases: 0, revenue: 0, frequency: 1.5 });

// 1) recency logic: same account, one ad spent yesterday (asOf), one stopped 3 weeks ago.
const live: RealAd = { externalId: "live", name: "Still running", objective: "traffic", adSetId: "s1", active: undefined, rows: [row("2026-08-20", 500), row("2026-08-29", 500)] };
const stopped: RealAd = { externalId: "stopped", name: "Ended weeks ago", objective: "traffic", adSetId: "s2", active: undefined, rows: [row("2026-08-01", 500), row("2026-08-08", 500)] };
const inputs = toCockpitInputs([live, stopped]); // asOf = 2026-08-29 (latest date across the account)
const liveIn = inputs.find((i) => i.id === "live")!;
const stoppedIn = inputs.find((i) => i.id === "stopped")!;
ok(liveIn.delivering === true, "ad that spent within 7 days of the window's last day is delivering");
ok(stoppedIn.delivering === false, "ad whose last spend was 3 weeks ago is NOT delivering (even with unknown status)");

// 2) the action queue gate: stopped ads produce zero actions but still appear on the leaderboard as history.
const base = analyzeAccount(SAMPLE_ADS, "SAMPLE");
ok(base.doThis.length > 0, "baseline: sample ads (delivery unknown) still produce actions");
const allStopped = SAMPLE_ADS.map((a) => ({ ...a, delivering: false }));
const s = analyzeAccount(allStopped, "SAMPLE");
ok(s.doThis.length === 0, "ads marked not-delivering produce ZERO actions in the queue");
ok(s.leaderboard.length === base.leaderboard.length, "not-delivering ads still appear on the leaderboard (history preserved)");

// 3) explicitly delivering keeps their actions (no over-filtering)
const allLive = SAMPLE_ADS.map((a) => ({ ...a, delivering: true }));
ok(analyzeAccount(allLive, "SAMPLE").doThis.length === base.doThis.length, "delivering ads keep every action they had");

console.log(`check-delivering: ${pass} assertions passed.`);
