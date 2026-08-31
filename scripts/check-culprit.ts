// Proof for the culprit diagnosis (lib/scoring/culprit.ts - the live one wired into CulpritBanner): it names a
// stopped, material contributor as the CAUSE of a recent drop, attributed on the metric that ACTUALLY dropped,
// and stays silent otherwise (never a false alarm).
// Run: node --experimental-strip-types scripts/check-culprit.ts

import { diagnoseCulprit, type DayPoint, type CulpritGroup } from "../lib/scoring/culprit.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const day = (d: number) => `2026-08-${String(d).padStart(2, "0")}`;
const DAYS = Array.from({ length: 14 }, (_, i) => 17 + i); // Aug 17..30 (prior week 17-23, recent 24-30)
const asOf = day(30);

// Account revenue fell hard in the recent week (40k/day -> 12k/day = 70% drop).
const account: DayPoint[] = DAYS.map((d) => ({ date: day(d), spend: d <= 23 ? 10000 : 3000, revenue: d <= 23 ? 40000 : 12000, purchases: d <= 23 ? 20 : 6 }));
// A big EARNING campaign spent + earned heavily the prior week then stopped; an evergreen keeps running.
const groups: CulpritGroup[] = [
  { id: "big", name: "Big Sale Campaign", daily: DAYS.filter((d) => d <= 23).map((d) => ({ date: day(d), spend: 8000, revenue: 30000 })) },
  { id: "ever", name: "Evergreen", daily: DAYS.map((d) => ({ date: day(d), spend: 2000, revenue: 8000 })) },
];

const dx = diagnoseCulprit(account, groups, asOf);
ok(dx.dropped, "a real revenue drop is detected");
ok(dx.metric === "revenue", "explains the drop on revenue when the account earns");
ok(dx.dropPct >= 0.5, `drop magnitude is reported (got ${Math.round(dx.dropPct * 100)}%)`);
ok(dx.culprits.length >= 1 && dx.culprits[0].id === "big", "the stopped big EARNING campaign is the top culprit");
ok(dx.culprits[0].shareOfPrior >= 0.7, "culprit was a large share of prior revenue");
ok(dx.culprits[0].stoppedOn === day(23), "reports when it last delivered");
ok(!!dx.summary && /stopped delivering|most likely cause|nothing to fix/i.test(dx.summary), "summary frames it as a cause, not an action");
ok(!!dx.summary && /prior revenue/.test(dx.summary), "summary attributes on the dropped metric (revenue), not spend");

// REGRESSION (bug found in review): a high-SPEND, ZERO-REVENUE awareness campaign that stops must NOT be blamed
// for a REVENUE drop - it earned nothing, so it cannot have caused revenue to fall.
const withAwareness: CulpritGroup[] = [
  ...groups,
  { id: "awareness", name: "Awareness_TOF_NoRevenue", daily: DAYS.filter((d) => d <= 23).map((d) => ({ date: day(d), spend: 12000, revenue: 0 })) },
];
const dxA = diagnoseCulprit(account, withAwareness, asOf);
ok(dxA.culprits.every((c) => c.id !== "awareness"), "a zero-revenue awareness campaign is NOT blamed for a revenue drop");
ok(dxA.culprits[0]?.id === "big", "the real earning culprit is still identified, despite the bigger-spend decoy");

// No drop -> silent (both campaigns keep running, revenue flat).
const flat: DayPoint[] = DAYS.map((d) => ({ date: day(d), spend: 5000, revenue: 20000, purchases: 10 }));
ok(!diagnoseCulprit(flat, groups, asOf).dropped, "no drop -> no culprit (stays silent)");

// Not enough history -> silent.
ok(diagnoseCulprit(account.slice(0, 6), groups, asOf).summary === null, "too little history -> silent");

// entityLabel flows into the plain-English summary.
const labelled = diagnoseCulprit(account, groups, asOf, "ad set");
ok(!!labelled.summary && /the ad set "Big Sale Campaign"/i.test(labelled.summary), "summary uses the given entity label");

// A LOGGED status change for the culprit corroborates the inferred stop (who + when).
const withLog = diagnoseCulprit(account, groups, asOf, "campaign", new Map([["big", { date: "2026-08-23", actorName: "Rahul Arora" }]]));
ok(!!withLog.summary && /by Rahul Arora on 2026-08-23, from your change log/.test(withLog.summary), "summary corroborates with the logged status change");
ok(!!diagnoseCulprit(account, groups, asOf, "campaign", new Map()).summary && !/change log/.test(diagnoseCulprit(account, groups, asOf, "campaign", new Map()).summary!), "no logged event -> inferred wording, no fabrication");

console.log(`check-culprit: ${pass} assertions passed.`);
