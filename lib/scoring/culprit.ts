// Culprit diagnosis: "a paused/ended campaign is WHY results dropped." The one place the app is allowed to
// point at a stopped entity - not as something to act on (you can't un-spend), but as the explanation for a
// recent decline. A top-1% buyer's first instinct when the account dips: "what did I turn off?" This encodes
// that. Pure, no I/O (scripts/check-culprit.ts). Never fabricates: every number comes from the day-wise rows.

// A group carries BOTH spend and revenue per day, because the culprit must be attributed on the metric that
// actually dropped: a revenue drop can only be caused by an entity that was EARNING revenue and stopped - a
// high-spend, zero-revenue awareness campaign that stops cannot lower revenue, so it must not be blamed for one.
export type CulpritGroup = { id: string; name: string; daily: { date: string; spend: number; revenue: number }[] };
export type DayPoint = { date: string; spend: number; revenue: number; purchases: number };

export type Culprit = { id: string; name: string; priorSpendRs: number; recentSpendRs: number; stoppedOn: string | null; shareOfPrior: number };
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

// Sum a group's spend (or revenue) inside [fromDate, toDate] inclusive.
function sumIn(daily: CulpritGroup["daily"], fromDate: string, toDate: string, field: "spend" | "revenue"): number {
  let s = 0;
  for (const d of daily) if (d.date >= fromDate && d.date <= toDate) s += d[field];
  return s;
}

/**
 * Given the account's day-wise points and the campaign/ad-set groups, decide whether results dropped in the
 * recent window and, if so, which STOPPED contributors best explain it. `asOf` = the window's last data day.
 */
export type StatusEvent = { date: string; actorName: string | null };

export function diagnoseCulprit(account: DayPoint[], groups: CulpritGroup[], asOf: string | null, entityLabel: "campaign" | "ad set" = "campaign", statusEvents?: Map<string, StatusEvent>): CulpritDiagnosis {
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

  // Attribute on the DROPPED metric: a contributor only explains the drop if it was a material share of that
  // metric before AND that metric collapsed for it now. So a revenue drop is pinned on an entity that was
  // EARNING revenue and stopped - never on a zero-revenue awareness campaign that merely spent a lot.
  const totalPrior = groups.reduce((s, g) => s + sumIn(g.daily, priorFrom, priorTo, metric), 0);
  const culprits: Culprit[] = [];
  for (const g of groups) {
    const priorM = sumIn(g.daily, priorFrom, priorTo, metric);
    const recentM = sumIn(g.daily, recentFrom, asOf, metric);
    const share = totalPrior > 0 ? priorM / totalPrior : 0;
    if (share >= MIN_SHARE && priorM > 0 && recentM <= priorM * STOPPED_RATIO) {
      let stoppedOn: string | null = null; // "stopped delivering" = the last day it actually spent
      for (const d of g.daily) if (d.spend > 0 && (stoppedOn === null || d.date > stoppedOn)) stoppedOn = d.date;
      culprits.push({
        id: g.id,
        name: g.name,
        priorSpendRs: Math.round(sumIn(g.daily, priorFrom, priorTo, "spend")),
        recentSpendRs: Math.round(sumIn(g.daily, recentFrom, asOf, "spend")),
        stoppedOn,
        shareOfPrior: share,
      });
    }
  }
  culprits.sort((a, b) => b.shareOfPrior - a.shareOfPrior);

  // Corroborate the top culprit's inferred stop with a LOGGED status change, when one exists for it - who
  // changed it, and when. Authoritative beats inferred; silently falls back to the inferred wording otherwise.
  const top = culprits[0];
  const logged = top ? statusEvents?.get(top.id) : undefined;
  const loggedNote = logged
    ? ` (status changed${logged.actorName ? ` by ${logged.actorName}` : ""} on ${logged.date}, from your change log)`
    : "";

  const summary = culprits.length
    ? `${metric === "revenue" ? "Revenue" : "Spend"} fell ${Math.round(dropPct * 100)}% in the last ${WINDOW} days. The ${entityLabel} "${top.name}" (${Math.round(top.shareOfPrior * 100)}% of prior ${metric}) stopped delivering${top.stoppedOn ? ` after ${top.stoppedOn}` : ""}${loggedNote} - the most likely cause. It is paused/ended, so there is nothing to fix on it; relaunch or reallocate if that result still matters.`
    : null;

  return { dropped: true, metric, dropPct, recentRs, priorRs, culprits, summary };
}
