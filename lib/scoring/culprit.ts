// Culprit diagnosis: "a paused/ended campaign is WHY results dropped." The one place the app is allowed to
// point at a stopped entity - not as something to act on (you can't un-spend), but as the explanation for a
// recent decline. A top-1% buyer's first instinct when the account dips: "what did I turn off?" This encodes
// that. Pure, no I/O (scripts/check-culprit.ts). Never fabricates: every number comes from the day-wise rows.

export type CulpritGroup = { id: string; name: string; daily: { date: string; spend: number }[] };
export type DayPoint = { date: string; spend: number; revenue: number; purchases: number };

export type Culprit = { id: string; name: string; priorSpendRs: number; recentSpendRs: number; stoppedOn: string | null; shareOfPriorSpend: number };
export type CulpritDiagnosis = {
  dropped: boolean;
  metric: "revenue" | "spend";
  dropPct: number; // 0..1, how far the recent window fell vs the prior window
  recentRs: number;
  priorRs: number;
  culprits: Culprit[];
  summary: string | null; // plain-English, or null when there is nothing to report
};

// calibrate-at-build.
const WINDOW = 7; // compare the last 7 delivering days vs the 7 before them
const MIN_DAYS = WINDOW * 2; // need both windows present to make the comparison
const MIN_DROP = 0.2; // a >=20% fall is a real drop worth explaining (below this is noise)
const STOPPED_RATIO = 0.15; // a contributor that fell to <=15% of its prior spend has effectively stopped
const MIN_SHARE = 0.1; // and only matters if it was >=10% of the account's prior spend

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

// Sum a group's spend inside [fromDate, toDate] inclusive.
function spendIn(daily: { date: string; spend: number }[], fromDate: string, toDate: string): number {
  let s = 0;
  for (const d of daily) if (d.date >= fromDate && d.date <= toDate) s += d.spend;
  return s;
}

/**
 * Given the account's day-wise points and the campaign/ad-set groups, decide whether results dropped in the
 * recent window and, if so, which STOPPED contributors best explain it. `asOf` = the window's last data day.
 */
export function diagnoseCulprit(account: DayPoint[], groups: CulpritGroup[], asOf: string | null): CulpritDiagnosis {
  const none: CulpritDiagnosis = { dropped: false, metric: "revenue", dropPct: 0, recentRs: 0, priorRs: 0, culprits: [], summary: null };
  if (!asOf) return none;
  const days = [...new Set(account.map((p) => p.date))].sort();
  if (days.length < MIN_DAYS) return none; // not enough history to compare two windows

  // Window boundaries anchored to asOf (data-relative, not wall-clock).
  const recentFrom = days[Math.max(0, days.length - WINDOW)];
  const priorTo = days[Math.max(0, days.length - WINDOW - 1)];
  const priorFrom = days[Math.max(0, days.length - WINDOW * 2)];

  const sum = (from: string, to: string, k: "revenue" | "spend" | "purchases") => account.filter((p) => p.date >= from && p.date <= to).reduce((s, p) => s + (p[k] || 0), 0);

  // Explain the drop on REVENUE if the account earns any, else on SPEND (a delivery/awareness account).
  const priorRev = sum(priorFrom, priorTo, "revenue");
  const metric: "revenue" | "spend" = priorRev > 0 ? "revenue" : "spend";
  const priorRs = sum(priorFrom, priorTo, metric);
  const recentRs = sum(recentFrom, asOf, metric);
  const dropPct = priorRs > 0 ? Math.max(0, (priorRs - recentRs) / priorRs) : 0;
  if (dropPct < MIN_DROP) return { ...none, metric, dropPct, recentRs, priorRs };

  // Which contributors were material before AND have effectively stopped now?
  const totalPriorSpend = groups.reduce((s, g) => s + spendIn(g.daily, priorFrom, priorTo), 0);
  const culprits: Culprit[] = [];
  for (const g of groups) {
    const priorSpendRs = spendIn(g.daily, priorFrom, priorTo);
    const recentSpendRs = spendIn(g.daily, recentFrom, asOf);
    const share = totalPriorSpend > 0 ? priorSpendRs / totalPriorSpend : 0;
    if (share >= MIN_SHARE && priorSpendRs > 0 && recentSpendRs <= priorSpendRs * STOPPED_RATIO) {
      let stoppedOn: string | null = null;
      for (const d of g.daily) if (d.spend > 0 && (stoppedOn === null || d.date > stoppedOn)) stoppedOn = d.date;
      culprits.push({ id: g.id, name: g.name, priorSpendRs: Math.round(priorSpendRs), recentSpendRs: Math.round(recentSpendRs), stoppedOn, shareOfPriorSpend: share });
    }
  }
  culprits.sort((a, b) => b.priorSpendRs - a.priorSpendRs);

  const summary = culprits.length
    ? `${metric === "revenue" ? "Revenue" : "Spend"} fell ${Math.round(dropPct * 100)}% in the last ${WINDOW} days. "${culprits[0].name}" (${Math.round(culprits[0].shareOfPriorSpend * 100)}% of prior spend) stopped delivering${culprits[0].stoppedOn ? ` after ${culprits[0].stoppedOn}` : ""} - the most likely cause. It is paused/ended, so there is nothing to fix on it; relaunch or reallocate if that result still matters.`
    : null;

  return { dropped: true, metric, dropPct, recentRs, priorRs, culprits, summary };
}
