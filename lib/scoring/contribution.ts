// Contribution economics (P1, the slice that needs only ONE input: a gross-margin %). PURE.
// Platform ROAS is a T3 number - it counts top-line attributed revenue, not money that reaches the bank.
// Given the account's gross-margin % (typed once in Settings), we turn Meta's own revenue/spend/purchases
// into margin-aware numbers the canon actually trusts:
//   contribution-margin ROAS = (revenue x margin%) / spend   -> is a rupee of ad spend returning MARGIN, not revenue?
//   contribution profit      = revenue x margin% - spend      -> the money left after product cost AND ad spend
//   implied COGS             = revenue x (1 - margin%)
//   AOV                      = revenue / purchases            -> needs NO margin (Meta already has purchases)
// This is NOT MER/nCAC (those need order + new-vs-returning data from Shopify); it is the margin correction
// on the numbers we already have. marginPct null/out-of-range -> the margin-dependent fields are null (honest),
// but AOV still computes.

export type ContributionInput = { revenueRs: number; spendRs: number; purchases: number; marginPct: number | null };
export type Contribution = {
  cmRoas: number | null; // contribution-margin ROAS (margin revenue / spend)
  contributionProfitRs: number | null; // revenue x margin% - spend
  cogsRs: number | null; // implied cost of goods
  netMarginPct: number | null; // the margin % in force (echoed for the KPI row)
  aov: number | null; // revenue / purchases (margin-independent)
};

// A gross margin is a percentage strictly between 0 and 100. Anything else is treated as "not set".
export function validMargin(marginPct: number | null | undefined): marginPct is number {
  return typeof marginPct === "number" && Number.isFinite(marginPct) && marginPct > 0 && marginPct < 100;
}

export function contribution(input: ContributionInput): Contribution {
  const { revenueRs, spendRs, purchases, marginPct } = input;
  const aov = purchases > 0 ? revenueRs / purchases : null;
  if (!validMargin(marginPct)) {
    return { cmRoas: null, contributionProfitRs: null, cogsRs: null, netMarginPct: null, aov };
  }
  const m = marginPct / 100;
  const marginRevenue = revenueRs * m;
  return {
    cmRoas: spendRs > 0 ? marginRevenue / spendRs : null,
    contributionProfitRs: marginRevenue - spendRs,
    cogsRs: revenueRs * (1 - m),
    netMarginPct: marginPct,
    aov,
  };
}
