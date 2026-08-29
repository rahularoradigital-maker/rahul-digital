// Roll the per-ad leaderboard up to ad, ad-set, or campaign level. Pure, no I/O.
// Sums only the base facts the leaderboard actually carries (spend, revenue, purchases)
// and derives ROAS + CPA from those sums, null on a zero denominator so a rollup never
// shows a fabricated ratio. CTR / CPC / CPM are deliberately absent: impressions and
// clicks are not on a leaderboard row (they live only on the account-level metrics), so
// they cannot be split per campaign / ad set without inventing a number.

import type { CockpitAd } from "./analyze.ts";

export type Level = "ad" | "adset" | "campaign";

// The subset of a leaderboard row this rollup needs. CockpitAd satisfies it directly.
export type LevelRow = Pick<
  CockpitAd,
  "id" | "name" | "adSetId" | "adsetName" | "campaignId" | "campaignName" | "spendRs" | "revenueRs" | "conversions"
>;

export type LevelMetrics = {
  key: string; // stable group key (id-preferred, name fallback)
  label: string; // readable name shown in the UI
  ads: number; // how many leaderboard rows rolled into this group
  spendRs: number;
  revenueRs: number;
  purchases: number;
  roas: number | null; // revenueRs / spendRs, null when spendRs <= 0
  cpaRs: number | null; // spendRs / purchases, null when purchases <= 0
};

const UNNAMED = "Unnamed";

// Prefer the stable id so two groups that happen to share a name never merge; fall back to
// the readable name, then a constant, so a missing id/name still groups deterministically.
function groupKeyOf(row: LevelRow, level: Level): string {
  if (level === "campaign") return row.campaignId || row.campaignName?.trim() || UNNAMED;
  if (level === "adset") return row.adSetId || row.adsetName?.trim() || UNNAMED;
  return row.id || row.name?.trim() || UNNAMED;
}

function labelOf(row: LevelRow, level: Level): string {
  if (level === "campaign") return row.campaignName?.trim() || UNNAMED;
  if (level === "adset") return row.adsetName?.trim() || UNNAMED;
  return row.name?.trim() || UNNAMED;
}

/** Group the rows by the chosen level, sum the base facts, derive ROAS + CPA. Sorted by spend desc. */
export function levelMetrics(rows: LevelRow[], level: Level): LevelMetrics[] {
  const groups = new Map<string, LevelMetrics>();
  for (const row of rows) {
    const key = groupKeyOf(row, level);
    let g = groups.get(key);
    if (!g) {
      g = { key, label: labelOf(row, level), ads: 0, spendRs: 0, revenueRs: 0, purchases: 0, roas: null, cpaRs: null };
      groups.set(key, g);
    }
    g.ads += 1;
    g.spendRs += row.spendRs;
    g.revenueRs += row.revenueRs;
    g.purchases += row.conversions;
  }
  const out = [...groups.values()];
  for (const g of out) {
    g.roas = g.spendRs > 0 ? g.revenueRs / g.spendRs : null;
    g.cpaRs = g.purchases > 0 ? g.spendRs / g.purchases : null;
  }
  out.sort((a, b) => b.spendRs - a.spendRs);
  return out;
}
