// Reconcile-with-Meta (pure, no I/O; gated by scripts/check-reconcile-scopes.ts).
// Explains why AdBrain's headline spend/ROAS differs from a FILTERED Meta Ads Manager view. AdBrain reports
// the WHOLE account; a media buyer's Meta view is usually filtered to active ad sets with results. This
// computes spend / revenue / ROAS / ad-count under each scope side by side, so the difference is one glance,
// not a mystery. Same source for every scope, so the comparison is apples-to-apples within AdBrain.

export type ReconAd = {
  spend: number;
  revenue: number;
  purchases: number;
  active: boolean | null; // effective status ACTIVE; null = unknown (kept, never hidden on a failed lookup)
  catalog: boolean;
};

export type ScopeTotals = { key: string; label: string; description: string; ads: number; spend: number; revenue: number; roas: number | null };
export type ReconReport = { scopes: ScopeTotals[]; total: number };

function tally(key: string, label: string, description: string, ads: ReconAd[], keep: (a: ReconAd) => boolean): ScopeTotals {
  let spend = 0, revenue = 0, n = 0;
  for (const a of ads) {
    if (!keep(a)) continue;
    spend += a.spend;
    revenue += a.revenue;
    n++;
  }
  return { key, label, description, ads: n, spend, revenue, roas: spend > 0 ? revenue / spend : null };
}

// The scopes, from broadest (what AdBrain shows) to narrowest (what a filtered Meta view usually shows).
export function computeScopes(ads: ReconAd[]): ReconReport {
  return {
    total: ads.length,
    scopes: [
      tally("whole", "Whole account", "Every ad that spent in the window, all statuses, catalog included. This is AdBrain's default headline number.", ads, () => true),
      tally("exclude_catalog", "Excluding catalog", "Whole account but dropping dynamic catalog (product-feed) ads.", ads, (a) => !a.catalog),
      tally("active", "Active only", "Only ads Meta reports as currently ACTIVE (paused/ended dropped).", ads, (a) => a.active !== false),
      tally("results", "With purchases", "Only ads that recorded at least one purchase in the window.", ads, (a) => a.purchases > 0),
      tally("active_results", "Active + purchases", "Active ads that also recorded purchases. This most closely matches a typical filtered Meta view (active delivery + results > 0).", ads, (a) => a.active !== false && a.purchases > 0),
    ],
  };
}
