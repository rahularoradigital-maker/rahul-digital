import { loadCockpit, parseDays } from "@/lib/app/cockpit-data";
import { KPI_CATALOG } from "@/lib/app/kpi-catalog";
import { KpiSelector } from "@/components/app/analytics/kpi-selector";

// Every KPI the product tracks, for reference, plus the handful of live values the
// connected Meta account can actually answer. The catalog is metadata (not account
// data) so it always renders, connected or not; only the numbers next to each row
// depend on a real connection, per the app's real-data-only rule.

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days } = await searchParams;
  const data = await loadCockpit(parseDays(days));

  const liveValues: Record<string, string> = {};
  if (data.connected) {
    const { totals } = data.view;
    const roasValue = totals.roas === null ? "n/a" : `${totals.roas.toFixed(2)}x`;
    liveValues.SPEND = rupees.format(totals.spendRs);
    liveValues.REVENUE = rupees.format(totals.revenueRs);
    liveValues.ROAS = roasValue;

    // The catalog's "platform ROAS" entry may or may not share the literal "ROAS"
    // code, so find it by code or name and map the same value onto it too.
    for (const kpi of KPI_CATALOG) {
      if (/roas/i.test(kpi.code) || kpi.name.toLowerCase().includes("platform roas")) {
        liveValues[kpi.code] = roasValue;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-[var(--ink)]">KPIs tracked per account</h1>
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

      <KpiSelector catalog={KPI_CATALOG} liveValues={liveValues} />
    </div>
  );
}
