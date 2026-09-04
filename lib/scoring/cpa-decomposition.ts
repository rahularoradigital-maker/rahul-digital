// CPA decomposition (the canon's "single most useful diagnostic identity"). PURE.
// CPA = spend / purchases can be written multiplicatively as:
//   CPA = costPerImpression / (CTR x CVR)   where costPerImpression = CPM/1000, CTR = clicks/impr, CVR = purchases/clicks
// So a CPA MOVEMENT decomposes cleanly into three drivers. In log space this is exact and additive:
//   dln(CPA) = dln(CPM) - dln(CTR) - dln(CVR)
// which tells you WHICH lever moved your cost per acquisition before anyone touches a bid - the discipline the
// canon insists on ("attribute a CPA move to CPM, CTR or CVR first"). Positive driver contribution = pushed
// CPA UP (worse); negative = pulled it DOWN (better). Returns "insufficient" when a window can't form a rate.

export type CpaWindow = { spend: number; impressions: number; clicks: number; purchases: number };

export type CpaDriver = "cpm" | "ctr" | "cvr";

export type CpaDecomposition = {
  ok: boolean;
  cpaBefore: number | null;
  cpaAfter: number | null;
  deltaPct: number | null; // signed % change in CPA (positive = CPA rose = worse)
  // Each driver's contribution to the CPA %-change (percentage points; they sum to ~deltaPct in log space).
  contributions: Record<CpaDriver, number> | null;
  dominant: CpaDriver | null; // the single driver that moved CPA the most (by absolute contribution)
  reason: string;
};

function metrics(w: CpaWindow): { cpm: number; ctr: number; cvr: number; cpa: number } | null {
  if (w.impressions <= 0 || w.clicks <= 0 || w.purchases <= 0 || w.spend <= 0) return null;
  const cpm = (w.spend / w.impressions) * 1000;
  const ctr = w.clicks / w.impressions;
  const cvr = w.purchases / w.clicks;
  const cpa = w.spend / w.purchases;
  return { cpm, ctr, cvr, cpa };
}

const round = (n: number) => Math.round(n * 10) / 10;
const LABEL: Record<CpaDriver, string> = { cpm: "CPM (auction cost)", ctr: "CTR (creative/targeting)", cvr: "CVR (landing/offer)" };

export function decomposeCpa(before: CpaWindow, after: CpaWindow): CpaDecomposition {
  const b = metrics(before);
  const a = metrics(after);
  if (!b || !a) {
    return { ok: false, cpaBefore: b?.cpa ?? null, cpaAfter: a?.cpa ?? null, deltaPct: null, contributions: null, dominant: null, reason: "not enough volume in one window to form CPM/CTR/CVR" };
  }
  // Log contributions (in %). dln(CPA) = dln(CPM) - dln(CTR) - dln(CVR); scale by 100 for percentage points.
  const cpm = Math.log(a.cpm / b.cpm) * 100;
  const ctr = -Math.log(a.ctr / b.ctr) * 100; // a CTR rise LOWERS cpa, so its contribution is negated
  const cvr = -Math.log(a.cvr / b.cvr) * 100;
  const contributions: Record<CpaDriver, number> = { cpm: round(cpm), ctr: round(ctr), cvr: round(cvr) };
  const deltaPct = round(((a.cpa - b.cpa) / b.cpa) * 100);
  const dominant = (Object.keys(contributions) as CpaDriver[]).reduce((m, k) => (Math.abs(contributions[k]) > Math.abs(contributions[m]) ? k : m), "cpm");
  const dir = contributions[dominant] > 0 ? "pushed CPA up" : "pulled CPA down";
  return {
    ok: true,
    cpaBefore: round(b.cpa),
    cpaAfter: round(a.cpa),
    deltaPct,
    contributions,
    dominant,
    reason: `CPA ${deltaPct >= 0 ? "rose" : "fell"} ${Math.abs(deltaPct)}%. Biggest driver: ${LABEL[dominant]} (${dir} ${Math.abs(contributions[dominant])}pp). Fix that lever before touching bids.`,
  };
}
