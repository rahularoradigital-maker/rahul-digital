import { KPI_CATALOG } from "@/lib/app/kpi-catalog";
import { KpiSelector } from "@/components/app/analytics/kpi-selector";
import { DailyTrendChart } from "@/components/app/analytics/daily-trend-chart";
import { windowHeadline } from "@/lib/cockpit/daily-series";
import { LevelMetricsSection } from "@/components/app/analytics/level-metrics";
import type { CockpitData } from "@/lib/app/cockpit-data";
import { rupees } from "@/lib/format";

// KPIs tab of the consolidated Media page. Logic reused verbatim from the former
// app/app/analytics/page.tsx: the catalog is metadata (not account data) so it
// always renders, connected or not; only the numbers next to each row depend on a
// real connection, per the app's real-data-only rule.


export function KpiSection({ data }: { data: CockpitData }) {
  const liveValues: Record<string, string> = {};
  if (data.connected) {
    // Scope-wide window totals (Ads-Manager-matching), NOT view.totals - view.totals is the top-N
    // analyzed-ads subset and under-reports true account spend/revenue.
    const totals = data.scopeTotals;
    const m = data.metrics;
    const count = new Intl.NumberFormat("en-IN");
    const rs = (v: number | null) => (v === null ? undefined : rupees.format(v));
    const pct = (v: number | null) => (v === null ? undefined : `${v.toFixed(2)}%`);
    const roasValue = totals.roas === null ? "n/a" : `${totals.roas.toFixed(2)}x`;

    // Account-level values the Meta account answers directly (all real, no fabrication).
    liveValues.SPEND = rupees.format(totals.spendRs);
    liveValues.REVENUE = rupees.format(totals.revenueRs);
    liveValues.CONV_VALUE = rupees.format(totals.revenueRs);
    liveValues.ROAS = roasValue;
    liveValues.IMPR = count.format(m.impressions);
    liveValues.CLICKS = count.format(m.clicks);
    const cpm = rs(m.cpm);
    if (cpm) liveValues.CPM = cpm;
    const ctr = pct(m.ctrAll);
    if (ctr) liveValues.CTR_ALL = ctr;
    const cpc = rs(m.cpcAll);
    if (cpc) liveValues.CPC_ALL = cpc;
    const cpa = rs(m.cpa);
    if (cpa) {
      liveValues.CPA = cpa;
      liveValues.CPP = cpa; // cost per purchase = spend / purchases (same base)
    }

    // The catalog's "platform ROAS" entry may not share the literal "ROAS" code,
    // so map the same value onto any roas-coded entry too.
    for (const kpi of KPI_CATALOG) {
      if (/roas/i.test(kpi.code) || kpi.name.toLowerCase().includes("platform roas")) {
        liveValues[kpi.code] = roasValue;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-normal tracking-tight text-[var(--ink)]">KPIs tracked per account</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-muted)]">
          Every metric this product tracks, {KPI_CATALOG.length} in all. This is reference metadata, not fabricated account
          data, so it always renders. Values light up next to a KPI as its data source connects, starting with your live
          Meta account.
        </p>
      </div>

      {!data.connected && (
        <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink-muted)]">
          Connect Meta to populate live values.{" "}
          <a href="/api/connect/meta/authorize" className="font-medium text-[var(--accent)] underline underline-offset-2">
            Connect Meta
          </a>
        </div>
      )}

      {data.connected && (
        <DailyTrendChart
          series={data.dailySeries}
          headline={windowHeadline(
            {
              spendRs: data.scopeTotals.spendRs,
              revenueRs: data.scopeTotals.revenueRs,
              roas: data.scopeTotals.roas,
              impressions: data.metrics.impressions,
              clicks: data.metrics.clicks,
              purchases: data.metrics.purchases,
              cpm: data.metrics.cpm,
              ctrAll: data.metrics.ctrAll,
              cpcAll: data.metrics.cpcAll,
              cpa: data.metrics.cpa,
            },
            data.funnel,
          )}
        />
      )}

      {data.connected && (
        <LevelMetricsSection
          rows={data.view.leaderboard.map((a) => ({
            id: a.id,
            name: a.name,
            adSetId: a.adSetId,
            adsetName: a.adsetName,
            campaignId: a.campaignId,
            campaignName: a.campaignName,
            spendRs: a.spendRs,
            revenueRs: a.revenueRs,
            conversions: a.conversions,
          }))}
        />
      )}

      <KpiSelector catalog={KPI_CATALOG} liveValues={liveValues} />
    </div>
  );
}
