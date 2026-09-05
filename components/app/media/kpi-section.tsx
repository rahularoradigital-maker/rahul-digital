import { cookies } from "next/headers";
import { KPI_CATALOG } from "@/lib/app/kpi-catalog";
import { contribution } from "@/lib/scoring/contribution";
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


export async function KpiSection({ data }: { data: CockpitData }) {
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

    // Contribution economics (P1): a typed gross-margin % (Settings) turns Meta's own revenue+spend into the
    // margin-aware CONTRIB_ROAS - whose catalog formula is exactly "(revenue x margin percent) / ad spend".
    // We ONLY light this row: AOV/CM/COGS/NET_MARGIN are Shopify/finance-sourced or differently defined
    // (per-order %, net not gross, unit-cost COGS), so filling them from Meta data would misrepresent them -
    // exactly the catalog-honesty rule. They stay "Needs {source}" until their real feed connects.
    const marginRaw = (await cookies()).get("adbrain.margin")?.value;
    const contrib = contribution({ revenueRs: totals.revenueRs, spendRs: totals.spendRs, purchases: m.purchases, marginPct: marginRaw ? Number(marginRaw) : null });
    if (contrib.cmRoas !== null) liveValues.CONTRIB_ROAS = `${contrib.cmRoas.toFixed(2)}x`;

    // The catalog's "platform ROAS" entry may not share the literal "ROAS" code,
    // so map the same value onto any roas-coded entry too.
    for (const kpi of KPI_CATALOG) {
      if (/roas/i.test(kpi.code) || kpi.name.toLowerCase().includes("platform roas")) {
        liveValues[kpi.code] = roasValue;
      }
    }
  }

  // Honest counts (P0 catalog honesty pass): how many KPIs actually carry a live value now vs. are computable
  // from Meta but not wired vs. need another source. Never imply we track more than we compute.
  const liveCount = Object.keys(liveValues).length;
  const metaBuildable = KPI_CATALOG.filter((k) => k.metaOnly && liveValues[k.code] === undefined).length;
  const needsSource = KPI_CATALOG.length - liveCount - metaBuildable;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-normal tracking-tight text-[var(--ink)]">KPIs tracked per account</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-muted)]">
          A reference catalog of {KPI_CATALOG.length} performance-marketing metrics. It is metadata, not fabricated data:
          a value shows only where we actually compute it.
          {data.connected
            ? ` Right now ${liveCount} are live, ${metaBuildable} are computable from your Meta account but not wired yet, and ${needsSource} need another source (Shopify, finance, GA4).`
            : " Connect Meta to light up the values we can compute today."}
        </p>
      </div>

      {!data.connected && (
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm px-4 py-3 text-sm text-[var(--ink-muted)]">
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

      <KpiSelector catalog={KPI_CATALOG} liveValues={liveValues} connected={data.connected} />
    </div>
  );
}
