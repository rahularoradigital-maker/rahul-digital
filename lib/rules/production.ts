// Creative production requirements (rules engine = source of truth). Pure functions:
// how many creatives to produce over a horizon, and in what priority order.
//
// Per the brief's CREATIVE SUPPLY logic: the 7/14/30-day creative requirement is tied
// to fatigue share + replacement rate (survival time). The output is a MODEL_ESTIMATE,
// never a fact. A null survival time → insufficient_data — we never assume an industry
// default (benchmark honesty rule: no hardcoded generic benchmarks).

export type ReplacementInput = {
  activeAds: number;
  fatiguedShare: number; // 0-1
  medianSurvivalDays: number | null;
  horizonDays: 7 | 14 | 30;
};

export type ReplacementResult =
  | { status: "ok"; creativesNeeded: number; rationale: string; factLabel: "MODEL_ESTIMATE" }
  | { status: "insufficient_data" };

/**
 * Creatives needed over the horizon = already-fatigued ads needing replacement now
 * (activeAds * fatiguedShare) + expected expiries of the healthy remainder at a
 * turnover rate of horizonDays / medianSurvivalDays. Rounded UP: a fraction of a
 * creative is a whole creative to produce.
 * ponytail: linear turnover model, no survival-curve fit — upgrade path is a real
 * per-account survival model once creative-lifetime history exists.
 */
export function replacementRequirement(input: ReplacementInput): ReplacementResult {
  const { activeAds, fatiguedShare, medianSurvivalDays, horizonDays } = input;
  if (
    medianSurvivalDays === null ||
    medianSurvivalDays <= 0 ||
    activeAds <= 0 ||
    fatiguedShare < 0 ||
    fatiguedShare > 1
  ) {
    return { status: "insufficient_data" };
  }

  const fatiguedNow = activeAds * fatiguedShare;
  const healthyAds = activeAds - fatiguedNow;
  const expectedExpiries = healthyAds * (horizonDays / medianSurvivalDays);
  const creativesNeeded = Math.ceil(fatiguedNow + expectedExpiries);

  return {
    status: "ok",
    creativesNeeded,
    rationale:
      `${fatiguedNow} fatigued ads need replacement now; ` +
      `${expectedExpiries.toFixed(1)} of ${healthyAds} healthy ads expected to expire ` +
      `over ${horizonDays} days at a ${medianSurvivalDays}-day median survival; rounded up.`,
    factLabel: "MODEL_ESTIMATE",
  };
}

export type ProductionGap = {
  kind: "hook" | "persona" | "angle" | "format";
  value: string;
  expectedImpact: "high" | "medium" | "low";
  urgency: "now" | "next" | "watch";
  confidence: number;
};

const IMPACT_RANK = { high: 0, medium: 1, low: 2 } as const;
const URGENCY_RANK = { now: 0, next: 1, watch: 2 } as const;

/**
 * Order gaps into a production brief list: impact desc, then urgency, then confidence
 * desc. Each gap maps to a one-line brief string. Pure ordering + formatting — the
 * output only reformulates the inputs, it invents nothing.
 */
export function productionPriorities(
  gaps: ProductionGap[],
): { brief: string; gap: ProductionGap }[] {
  return [...gaps]
    .sort(
      (a, b) =>
        IMPACT_RANK[a.expectedImpact] - IMPACT_RANK[b.expectedImpact] ||
        URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
        b.confidence - a.confidence,
    )
    .map((gap) => ({
      brief:
        `Test a ${gap.value} ${gap.kind} ` +
        `(impact: ${gap.expectedImpact}, urgency: ${gap.urgency}, ` +
        `confidence: ${gap.confidence}).`,
      gap,
    }));
}
