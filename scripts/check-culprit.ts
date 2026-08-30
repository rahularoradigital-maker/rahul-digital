// Proof for the culprit diagnosis: it flags a recent drop and names the stopped contributor that explains it,
// and stays silent when nothing dropped. Run: node --experimental-strip-types scripts/check-culprit.ts

import { diagnoseCulprit, type CulpritGroup, type DayPoint } from "../lib/scoring/culprit.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// 14 days: 2026-08-01 .. 2026-08-14. asOf = 08-14. prior = 08-01..08-07, recent = 08-08..08-14.
const days = Array.from({ length: 14 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`);
const asOf = days[days.length - 1];

// Account revenue high in the prior week, then halves in the recent week (a real drop).
const account: DayPoint[] = days.map((date, i) => ({ date, spend: 10000, revenue: i < 7 ? 40000 : 18000, purchases: i < 7 ? 20 : 9 }));

// Big campaign A spent heavily then STOPPED after 08-07; small campaign B keeps running.
const groups: CulpritGroup[] = [
  { id: "A", name: "Lyxel_Big_Sale", daily: days.map((date, i) => ({ date, spend: i < 7 ? 6000 : 0 })) },
  { id: "B", name: "Lyxel_Evergreen", daily: days.map((date) => ({ date, spend: 4000 })) },
];

const d = diagnoseCulprit(account, groups, asOf);
ok(d.dropped, "a >=20% revenue drop is detected");
ok(d.metric === "revenue", "explains the drop on revenue (account earns revenue)");
ok(d.culprits.length >= 1, "at least one culprit found");
ok(d.culprits[0].id === "A", "the big STOPPED campaign is the top culprit, not the still-running one");
ok(d.culprits[0].stoppedOn === "2026-08-07", "culprit's last delivering day is identified");
ok(d.culprits.every((c) => c.id !== "B"), "the still-delivering campaign is NOT blamed");
ok(d.summary != null && d.summary.includes("Lyxel_Big_Sale"), "summary names the culprit in plain English");
ok(d.summary!.includes("nothing to fix"), "summary makes clear the dead entity is not actionable");

// No drop -> silent (no false alarm).
const steady: DayPoint[] = days.map((date) => ({ date, spend: 10000, revenue: 40000, purchases: 20 }));
const q = diagnoseCulprit(steady, groups, asOf);
ok(!q.dropped, "steady account -> no drop reported");
ok(q.summary === null, "no drop -> no summary (no false alarm)");

// Too little history -> silent.
const short = diagnoseCulprit(account.slice(0, 6), groups.map((g) => ({ ...g, daily: g.daily.slice(0, 6) })), days[5]);
ok(!short.dropped && short.summary === null, "under two windows of data -> no diagnosis");

console.log(`check-culprit: ${pass} assertions passed.`);
