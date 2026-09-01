// Ad-level funnel ratio engine for AdScale.
// A top-1% D2C media buyer does not read raw spend/clicks: they read the ratios
// between funnel stages (thumb-stop, hold, LP view, ATC, checkout, purchase) to
// see exactly which stage is leaking. This computes those ratios from day-wise
// rows, either aggregated over the whole window or per day for trend reads.
//
// Pure, no I/O, no dependencies.

export type ExtendedMetricsRow = {
  date: string;            // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;          // all clicks
  outboundClicks: number;  // link clicks out
  video3sViews: number;    // 3-second video plays
  videoThruplays: number;  // thruplays (~15s or complete)
  landingPageViews: number;
  addToCarts: number;
  initiateCheckouts: number;
  purchases: number;
};

export type FunnelMetrics = {
  ctr: number | null;            // clicks / impressions (%)
  cpm: number | null;            // spend / impressions * 1000
  cpc: number | null;            // spend / clicks
  thumbStopRate: number | null;  // video3sViews / impressions (%)
  holdRate: number | null;       // videoThruplays / video3sViews (%)
  lpViewRate: number | null;     // landingPageViews / outboundClicks (%)
  atcRate: number | null;        // addToCarts / landingPageViews (%)
  checkoutRate: number | null;   // initiateCheckouts / addToCarts (%)
  purchaseRate: number | null;   // purchases / initiateCheckouts (%)
};

// One guard for every ratio: a 0 denominator means "no data to divide", not 0.
// Returning null (never NaN/Infinity/a fabricated number) keeps downstream reads
// honest - a missing ratio is shown as missing, not as a false floor.
function ratio(numerator: number, denominator: number, scale = 1): number | null {
  if (!denominator) return null;
  return (numerator / denominator) * scale;
}

// Compute the 9 funnel ratios from a single already-summed set of totals.
export function funnelFromTotals(t: ExtendedMetricsRow): FunnelMetrics {
  return {
    ctr: ratio(t.clicks, t.impressions, 100),
    cpm: ratio(t.spend, t.impressions, 1000),
    cpc: ratio(t.spend, t.clicks),
    thumbStopRate: ratio(t.video3sViews, t.impressions, 100),
    holdRate: ratio(t.videoThruplays, t.video3sViews, 100),
    lpViewRate: ratio(t.landingPageViews, t.outboundClicks, 100),
    atcRate: ratio(t.addToCarts, t.landingPageViews, 100),
    checkoutRate: ratio(t.initiateCheckouts, t.addToCarts, 100),
    purchaseRate: ratio(t.purchases, t.initiateCheckouts, 100),
  };
}

// Sum the counting fields across all day rows. Ratios must be computed from
// summed totals, never averaged from per-day ratios - averaging ratios weights
// low-volume days equally with high-volume ones and distorts the real window.
export function sumRows(rows: ExtendedMetricsRow[]): ExtendedMetricsRow {
  return rows.reduce<ExtendedMetricsRow>(
    (acc, r) => ({
      date: "",
      spend: acc.spend + r.spend,
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      outboundClicks: acc.outboundClicks + r.outboundClicks,
      video3sViews: acc.video3sViews + r.video3sViews,
      videoThruplays: acc.videoThruplays + r.videoThruplays,
      landingPageViews: acc.landingPageViews + r.landingPageViews,
      addToCarts: acc.addToCarts + r.addToCarts,
      initiateCheckouts: acc.initiateCheckouts + r.initiateCheckouts,
      purchases: acc.purchases + r.purchases,
    }),
    {
      date: "",
      spend: 0,
      impressions: 0,
      clicks: 0,
      outboundClicks: 0,
      video3sViews: 0,
      videoThruplays: 0,
      landingPageViews: 0,
      addToCarts: 0,
      initiateCheckouts: 0,
      purchases: 0,
    }
  );
}

// Aggregate over the whole window: sum the days, then divide once.
export function windowFunnel(rows: ExtendedMetricsRow[]): FunnelMetrics {
  return funnelFromTotals(sumRows(rows));
}

// Per-day series for trend/day-wise reads: each entry's ratios come from that
// single day's own numbers.
export function dailyFunnel(
  rows: ExtendedMetricsRow[]
): { date: string; metrics: FunnelMetrics }[] {
  return rows.map((r) => ({ date: r.date, metrics: funnelFromTotals(r) }));
}
