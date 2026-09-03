// Pure ranking + flagging for creative rollups (no I/O, no server-only) so the check can import it directly.
export type CreativeFlag = "winner" | "wasting" | "steady";
export type CreativeAgg = {
  adId: string;
  name: string;
  spend: number;
  revenue: number;
  purchases: number;
  roas: number | null;
  active: boolean | null;
  flag?: CreativeFlag;
};

export const DEFAULT_TOP_N = 50; // enough for a "top movers" view; keeps the stored row small

// Material-spend gate for flagging: an ad must have spent at least this SHARE of the account's total spend to
// be judged a winner/waster. Scale-free (no fabricated rupee threshold) - a tiny-budget ad is "steady" (too
// little signal to call), not a false winner/waster off one lucky/unlucky sale.
const MATERIAL_SHARE = 0.01; // 1% of account spend

// Classify each ad against the ACCOUNT's own average ROAS (its own bar, not a universal benchmark):
// winner = materially above average, wasting = spending but far below (or no return), else steady.
export function classifyCreatives(aggs: CreativeAgg[]): CreativeAgg[] {
  const totalSpend = aggs.reduce((s, a) => s + a.spend, 0);
  const totalRev = aggs.reduce((s, a) => s + a.revenue, 0);
  const avgRoas = totalSpend > 0 ? totalRev / totalSpend : null;
  const materialFloor = totalSpend * MATERIAL_SHARE;
  return aggs.map((a) => ({ ...a, flag: classifyOne(a, avgRoas, materialFloor) }));
}

function classifyOne(a: CreativeAgg, avgRoas: number | null, materialFloor: number): CreativeFlag {
  if (avgRoas == null || a.spend < materialFloor) return "steady"; // too small / no account bar -> don't judge
  if (a.roas != null && a.roas >= avgRoas * 1.2) return "winner"; // materially above the account's own average
  if (a.roas == null || a.roas < avgRoas * 0.5) return "wasting"; // spending materially, far below average / no return
  return "steady";
}

// Rank by spend descending (biggest budget = biggest lever), keep the top N. Stable + deterministic: ties
// break by adId so the same input always yields the same order.
export function topCreatives(aggs: CreativeAgg[], n: number = DEFAULT_TOP_N): CreativeAgg[] {
  return [...aggs]
    .sort((a, b) => (b.spend - a.spend) || a.adId.localeCompare(b.adId))
    .slice(0, Math.max(0, n));
}
