// Account-level intelligence (rules engine = source of truth). Pure functions over
// pre-computed per-ad aggregates: callers build AdSummary from MetricsRows + fatigue();
// this module deliberately imports neither, so it stays independent and testable.
//
// Honesty rules (brief + [02] Meta Data Mapping):
// - Concentration/trapped/rollup = INTERNAL CALCULATION over the caller's aggregates.
// - Marginal ROAS / elasticity / "next dollar" = INFERENCE per [02] — needs
//   spend-response history or a lift test we do not have. We therefore NEVER emit an
//   estimated marginal number; scalingHeadroom always carries caveat MARGINAL_UNKNOWN
//   and a nextDollar explicitly marked insufficient_data.
// - Empty / zero-spend input → insufficient_data sentinel, never a fabricated share.

/** Per-ad aggregate the caller computes upstream. fatigueIndex is 0-1 or null (unassessed). */
export type AdSummary = {
  adId: string;
  spend: number;
  revenue: number;
  fatigueIndex: number | null;
  conceptId?: string | null;
};

// Fatigue cut above which spend is considered trapped, and at-or-above which an ad is
// disqualified as a scale candidate. Matches fatigue.ts pastHalfLife (score >= 0.7).
// ponytail: calibrate-at-build heuristic per [01c] benchmark honesty — per-account
// calibration against its own baseline is the upgrade path, not a hardcoded truth.
const FATIGUE_CUT = 0.7;

const INSUFFICIENT = { status: "insufficient_data" } as const;

function totalSpend(ads: AdSummary[]): number {
  return ads.reduce((acc, a) => acc + a.spend, 0);
}

export type ConcentrationResult =
  | {
      status: "ok";
      top1Share: number;
      top3Share: number;
      top5Share: number;
      byConcept?: { conceptId: string; share: number }[];
    }
  | typeof INSUFFICIENT;

/**
 * Spend concentration: share of total spend in the top 1 / 3 / 5 ads, plus per-concept
 * shares when concept tags exist (untagged ads stay in the denominator only).
 * Empty input or zero total spend → insufficient_data (a share of nothing is not 0%).
 */
export function budgetConcentration(ads: AdSummary[]): ConcentrationResult {
  const total = totalSpend(ads);
  if (ads.length === 0 || total === 0) return INSUFFICIENT;

  const bySpend = [...ads].sort((a, b) => b.spend - a.spend);
  const topShare = (n: number) =>
    bySpend.slice(0, n).reduce((acc, a) => acc + a.spend, 0) / total;

  const result: ConcentrationResult = {
    status: "ok",
    top1Share: topShare(1),
    top3Share: topShare(3),
    top5Share: topShare(5),
  };

  const spendByConcept = new Map<string, number>();
  for (const a of ads) {
    if (a.conceptId != null) {
      spendByConcept.set(a.conceptId, (spendByConcept.get(a.conceptId) ?? 0) + a.spend);
    }
  }
  if (spendByConcept.size > 0) {
    result.byConcept = [...spendByConcept.entries()]
      .map(([conceptId, spend]) => ({ conceptId, share: spend / total }))
      .sort((a, b) => b.share - a.share);
  }
  return result;
}

export type TrappedBudgetResult =
  | { status: "ok"; trappedRs: number; unassessedRs: number; ads: string[] }
  | typeof INSUFFICIENT;

/**
 * Spend sitting on assessed-fatigued ads (fatigueIndex >= FATIGUE_CUT). Null fatigue
 * means UNKNOWN: that spend is reported separately as unassessedRs and NEVER counted
 * as trapped — we do not diagnose ads we could not assess.
 */
export function trappedBudget(ads: AdSummary[]): TrappedBudgetResult {
  if (ads.length === 0) return INSUFFICIENT;

  let trappedRs = 0;
  let unassessedRs = 0;
  const trappedAds: string[] = [];
  for (const a of ads) {
    if (a.fatigueIndex === null) {
      unassessedRs += a.spend;
    } else if (a.fatigueIndex >= FATIGUE_CUT) {
      trappedRs += a.spend;
      trappedAds.push(a.adId);
    }
  }
  return { status: "ok", trappedRs, unassessedRs, ads: trappedAds };
}

export type ScalingHeadroomResult =
  | {
      status: "ok";
      candidates: { adId: string; roas: number }[];
      caveat: "MARGINAL_UNKNOWN";
      nextDollar: { status: "insufficient_data"; needs: string };
    }
  | typeof INSUFFICIENT;

/**
 * Scale candidates: average ROAS above the account median AND assessed-healthy fatigue
 * (fatigueIndex < FATIGUE_CUT; null = unknown, never a candidate). HONESTY CEILING:
 * average ROAS is not marginal ROAS. True next-dollar efficiency is INFERENCE per
 * [02] and needs spend-response data we do not have, so the result always carries
 * caveat MARGINAL_UNKNOWN and a nextDollar that says exactly what is missing.
 * No estimated marginal number is ever emitted.
 */
export function scalingHeadroom(ads: AdSummary[]): ScalingHeadroomResult {
  const withSpend = ads.filter((a) => a.spend > 0);
  if (withSpend.length === 0) return INSUFFICIENT;

  const roasValues = withSpend.map((a) => a.revenue / a.spend).sort((a, b) => a - b);
  const mid = Math.floor(roasValues.length / 2);
  const median =
    roasValues.length % 2 === 1
      ? roasValues[mid]
      : (roasValues[mid - 1] + roasValues[mid]) / 2;

  const candidates = withSpend
    .filter(
      (a) =>
        a.revenue / a.spend > median &&
        a.fatigueIndex !== null &&
        a.fatigueIndex < FATIGUE_CUT,
    )
    .map((a) => ({ adId: a.adId, roas: a.revenue / a.spend }))
    .sort((a, b) => b.roas - a.roas);

  return {
    status: "ok",
    candidates,
    caveat: "MARGINAL_UNKNOWN",
    nextDollar: {
      status: "insufficient_data",
      needs: "spend-response history or lift test (INFERENCE per 02-meta-data-mapping)",
    },
  };
}

export type WasteRollupResult =
  | { status: "ok"; totalWastedRs: number; shareOfSpend: number }
  | typeof INSUFFICIENT;

/**
 * Roll per-ad waste figures up to the account: total rupees + share of total spend.
 * Empty waste list or non-positive total spend → insufficient_data (no share exists).
 */
export function wasteRollup(
  perAdWaste: { adId: string; wastedRs: number }[],
  totalSpendRs: number,
): WasteRollupResult {
  if (perAdWaste.length === 0 || totalSpendRs <= 0) return INSUFFICIENT;
  const totalWastedRs = perAdWaste.reduce((acc, w) => acc + w.wastedRs, 0);
  return { status: "ok", totalWastedRs, shareOfSpend: totalWastedRs / totalSpendRs };
}
