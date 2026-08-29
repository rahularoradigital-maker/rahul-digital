import { loadCockpit, parseDays } from "@/lib/app/cockpit-data";
import { Tabs } from "@/components/app/tabs";
import { BudgetSection } from "@/components/app/media/budget-section";
import { KpiSection } from "@/components/app/media/kpi-section";

// Media: consolidates Budget & Scaling and KPIs into one page with a 2-tab bar,
// loading the cockpit once and handing the same data to both tabs.

export const maxDuration = 300; // heavy 90-day day-wise cold pull needs headroom to warm the cache

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ days?: string; tab?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab ?? "budget";
  const data = await loadCockpit(parseDays(sp.days));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-normal tracking-tight text-[var(--ink)]">Media</h1>
      </div>

      <Tabs
        tabs={[
          { key: "budget", label: "Budget & Scaling" },
          { key: "kpis", label: "KPIs" },
        ]}
      />

      {tab === "budget" ? <BudgetSection data={data} days={data.days} /> : <KpiSection data={data} />}
    </div>
  );
}
