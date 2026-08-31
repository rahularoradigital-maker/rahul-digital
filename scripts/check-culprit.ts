// Proof for the culprit diagnosis (lib/scoring/culprit.ts - the live one wired into CulpritBanner): it names a
// stopped, material contributor as the CAUSE of a recent drop, and stays silent otherwise (never a false alarm).
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

// Account revenue fell hard in the recent week (10k/day -> 3k/day = 70% drop).
const account: DayPoint[] = DAYS.map((d) => ({ date: day(d), spend: d <= 23 ? 10000 : 3000, revenue: d <= 23 ? 40000 : 12000, purchases: d <= 23 ? 20 : 6 }));
// A big campaign spent heavily the prior week then stopped; an evergreen keeps running.
const groups: CulpritGroup[] = [
  { id: "big", name: "Big Sale Campaign", daily: DAYS.filter((d) => d <= 23).map((d) => ({ date: day(d), spend: 8000 })) },
  { id: "ever", name: "Evergreen", daily: DAYS.map((d) => ({ date: day(d), spend: 2000 })) },
];

const dx = diagnoseCulprit(account, groups, asOf);
ok(dx.dropped, "a real revenue drop is detected");
ok(dx.metric === "revenue", "explains the drop on revenue when the account earns");
ok(dx.dropPct >= 0.5, `drop magnitude is reported (got ${Math.round(dx.dropPct * 100)}%)`);
ok(dx.culprits.length >= 1 && dx.culprits[0].id === "big", "the stopped big campaign is the top culprit");
ok(dx.culprits[0].shareOfPriorSpend >= 0.7, "culprit was a large share of prior spend");
ok(dx.culprits[0].stoppedOn === day(23), "reports when it last delivered");
ok(!!dx.summary && /stopped delivering|most likely cause|nothing to fix/i.test(dx.summary), "summary frames it as a cause, not an action");

// No drop -> silent (both campaigns keep running, revenue flat).
const flat: DayPoint[] = DAYS.map((d) => ({ date: day(d), spend: 5000, revenue: 20000, purchases: 10 }));
const dxFlat = diagnoseCulprit(flat, groups, asOf);
ok(!dxFlat.dropped && dxFlat.summary === null, "no drop -> no culprit, no summary (stays silent)");

// Not enough history -> silent.
const short = account.slice(0, 6);
ok(diagnoseCulprit(short, groups, asOf).summary === null, "too little history -> silent");

// entityLabel flows into the plain-English summary, so ad-set-grain culprits read as "the ad set ...".
const labelled = diagnoseCulprit(account, groups, asOf, "ad set");
ok(!!labelled.summary && /the ad set "Big Sale Campaign"/i.test(labelled.summary), "summary uses the given entity label (ad set vs campaign)");

// A LOGGED status change for the culprit corroborates the inferred stop (who + when), when available.
const withLog = diagnoseCulprit(account, groups, asOf, "campaign", new Map([["big", { date: "2026-08-23", actorName: "Rahul Arora" }]]));
ok(!!withLog.summary && /by Rahul Arora on 2026-08-23, from your change log/.test(withLog.summary), "summary corroborates with the logged status change (actor + date)");
// Absent a logged event, it falls back to the inferred wording (no crash, no fabrication).
const noLog = diagnoseCulprit(account, groups, asOf, "campaign", new Map());
ok(!!noLog.summary && !/change log/.test(noLog.summary), "no logged event -> inferred wording, no fabricated log reference");

console.log(`check-culprit: ${pass} assertions passed.`);
