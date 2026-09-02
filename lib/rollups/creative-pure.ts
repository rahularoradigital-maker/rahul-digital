// Pure ranking for creative rollups (no I/O, no server-only) so the check can import it directly.
export type CreativeAgg = {
  adId: string;
  name: string;
  spend: number;
  revenue: number;
  purchases: number;
  roas: number | null;
  active: boolean | null;
};

export const DEFAULT_TOP_N = 50; // enough for a "top movers" view; keeps the stored row small

// Rank by spend descending (biggest budget = biggest lever), keep the top N. Stable + deterministic: ties
// break by adId so the same input always yields the same order.
export function topCreatives(aggs: CreativeAgg[], n: number = DEFAULT_TOP_N): CreativeAgg[] {
  return [...aggs]
    .sort((a, b) => (b.spend - a.spend) || a.adId.localeCompare(b.adId))
    .slice(0, Math.max(0, n));
}
