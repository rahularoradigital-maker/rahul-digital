// Plain-English formula for every headline / KPI metric shown on the cockpit, defined once so the
// hover "i" on each metric tile can show exactly how the number is made (charter: "a number must be
// defended, not decorated"). Pure data + no imports, so a UI tile, a check, or a drawer can all read
// the SAME string - the formula a user hovers is the formula we actually compute, never a second copy
// that can drift. No invented numbers here: these describe the maths, the real values come from data.

export const METRIC_FORMULA: Record<string, string> = {
  // Headline decision KPIs
  blendedRoas: "Blended ROAS = total revenue / total spend, across the selected scope and window. A raw platform ratio Meta reports both sides of, not a judgement. Shown as n/a when spend is 0 (never a fabricated ratio).",
  concentration: "Concentration = spend on the single top ad / total spend x 100. High means the account leans on one creative, so its fatigue hits results hard.",
  accountHealth: "Account Health = spend-weighted average of each ad's objective score (ROAS for sales, CTR/CPM for awareness), minus a 25 x wasted-spend-share penalty. 0-100.",

  // Money + volume
  roas: "ROAS = revenue / spend for the ad.",
  spend: "Spend = amount Meta charged for the selected ads in the window.",
  revenue: "Revenue = purchase conversion value Meta attributed to the selected ads in the window.",
  purchases: "Purchases = count of purchase conversions Meta attributed to the ads.",

  // Efficiency
  cpa: "CPA = spend / purchases (cost per purchase).",
  cpc: "CPC = spend / link clicks (cost per click).",
  cpm: "CPM = spend / impressions x 1,000 (cost per thousand impressions).",
  ctr: "CTR = clicks / impressions x 100 (click-through rate).",

  // Reach
  impressions: "Impressions = number of times the ads were shown.",
  clicks: "Clicks = link clicks on the ads.",
  reach: "Reach = unique people who saw the ads (Meta-reported).",
  frequency: "Frequency = impressions / reach (average times each person saw an ad).",
  budget: "Budget = the budget Meta has set for this ad set / campaign (daily or lifetime).",

  // Funnel micro-conversions (each step vs the step before it)
  thumbStop: "Thumb-stop rate = 3-second video views / impressions x 100 (how many stop scrolling).",
  holdRate: "Hold rate = ThruPlays / 3-second views x 100 (how many keep watching after stopping).",
  lpViewRate: "LP view rate = landing-page views / link clicks x 100 (how many clicks actually load the page).",
  atcRate: "Add-to-cart rate = add-to-carts / landing-page views x 100.",
  checkoutRate: "Checkout rate = checkouts initiated / add-to-carts x 100.",
};

// Lookup with a safe empty fallback, so a tile for a metric without a formula simply renders no hint
// instead of throwing. (The check keeps this from happening for the known KPI set.)
export function formulaFor(key: string): string {
  return METRIC_FORMULA[key] ?? "";
}
