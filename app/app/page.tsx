import { loadCockpit, parseDays } from "@/lib/app/cockpit-data";
import { ConnectState } from "@/components/app/connect-state";
import { type CockpitView, type Verdict } from "@/lib/cockpit/analyze";
import { HealthRing } from "@/components/cockpit/HealthRing";
import { HealthComposition, type CompositionRow } from "@/components/cockpit/HealthComposition";
import { KpiCard } from "@/components/cockpit/KpiCard";
import { ActionList } from "@/components/cockpit/ActionList";
import { FatigueRadar } from "@/components/cockpit/FatigueRadar";
import { Leaderboard } from "@/components/cockpit/Leaderboard";
import { WhyDrawer } from "@/components/cockpit/WhyDrawer";

// The Account Cockpit. Real connected-account data only: if nothing real is
// available, loadCockpit returns connected:false and we render the Connect state.
// No sample or placeholder numbers ever reach this screen.

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days } = await searchParams;
  const data = await loadCockpit(parseDays(days));

  if (!data.connected) {
    return <ConnectState reason={data.reason} errorNote={data.errorNote} accountName={data.accountName} days={data.days} />;
  }

  return <Cockpit view={data.view} accountName={data.accountName} accountId={data.accountId} adsAnalyzed={data.adsAnalyzed} days={data.days} />;
}

// Share of total spend on each verdict, an honest breakdown of where Account Health
// comes from (leaderboard verdicts + totals), not fabricated component scores.
function compositionRows(view: CockpitView): CompositionRow[] {
  const total = view.totals.spendRs;
  const shareOn = (v: Verdict) =>
    total > 0 ? view.leaderboard.filter((a) => a.verdict === v).reduce((acc, a) => acc + a.spendRs, 0) / total : 0;
  const wasteShare = view.waste.status === "ok" ? view.waste.shareOfSpend : 0;
  return [
    { label: "Spend on winners", share: shareOn("winner"), bar: "bg-[var(--good-ink)]" },
    { label: "Needs refresh", share: shareOn("refresh"), bar: "bg-[var(--warn-ink)]" },
    { label: "On hold / watch", share: shareOn("do_not_kill_yet"), bar: "bg-[var(--accent)]" },
    { label: "Spend on losers", share: shareOn("loser"), bar: "bg-[var(--bad-ink)]" },
    { label: "Wasted spend", share: wasteShare, bar: "bg-[var(--bad-ink)]" },
  ];
}

function Cockpit({ view, accountName, accountId, adsAnalyzed, days }: { view: CockpitView; accountName: string; accountId: string; adsAnalyzed: number; days: number }) {
  const health = view.accountHealth;
  const roas = view.totals.roas;
  const conc = view.concentration;

  return (
    <div className="space-y-6">
      {/* Context line */}
      <div>
        <div className="flex items-center gap-2 text-[13px] text-[var(--ink-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--good-ink)]" />
          {`Live · ${accountName} · ${adsAnalyzed} real ads · last ${days} days`}
        </div>
        <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight">Here&apos;s what to ship this week.</h1>
      </div>

      {/* Account Health */}
      <div className="grid grid-cols-1 items-center gap-8 rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6 md:grid-cols-[200px_1fr]">
        <HealthRing score={health.score} />
        <div>
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="text-base font-semibold">Account Health</div>
              <WhyDrawer explanation={view.accountHealth.explain} />
            </div>
            <span className="rounded-[70px] border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">
              Internal calculation · {health.factLabel}
            </span>
          </div>
          <div className="mb-4 text-[13px] text-[var(--ink-muted)]">{health.basis}</div>
          <HealthComposition rows={compositionRows(view)} />
        </div>
      </div>

      {/* Decision KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Blended ROAS"
          tip="Revenue divided by spend, blended across the account. Source: connected Meta account."
          value={roas === null ? "n/a" : `${roas.toFixed(2)}x`}
          sub={`${rupees.format(view.totals.revenueRs)} on ${rupees.format(view.totals.spendRs)}`}
        />
        <KpiCard
          label="MER"
          tip="Marketing efficiency ratio = total revenue divided by total ad spend."
          insufficient="Connect Shopify for store revenue"
        />
        <KpiCard
          label="nCAC"
          tip="New-customer acquisition cost. Requires Shopify new-vs-returning split."
          insufficient="Connect more sources"
        />
        <KpiCard
          label="Concentration"
          tip="Share of spend on the single top ad. Internal calculation over your account."
          value={conc.status === "ok" ? `${Math.round(conc.top1Share * 100)}%` : undefined}
          insufficient={conc.status === "ok" ? undefined : "Not enough spend to assess"}
          sub={conc.status === "ok" ? "top ad share of spend" : undefined}
        />
      </div>

      {/* This week's plan + Fatigue radar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <ActionList items={view.doThis} ads={view.leaderboard} accountId={accountId} />
        <FatigueRadar ads={view.leaderboard} halfLife={view.creativeHalfLife} accountId={accountId} />
      </div>

      {/* Creative leaderboard */}
      <Leaderboard ads={view.leaderboard} rupees={rupees} accountId={accountId} />

      {/* Wasted spend */}
      {view.waste.status === "ok" && (
        <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
          <div className="mb-1 text-base font-semibold">Budget waste</div>
          <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
            High spend plus poor economics. Small-spend low-ROAS ads are excluded. Insufficient data is not waste.
          </div>
          <div className="flex items-end justify-between gap-4 border-t border-[var(--surface-alt)] pt-4">
            <div>
              <div className="text-[30px] font-semibold tracking-tight tabular-nums leading-none text-[var(--bad-ink)]">
                {rupees.format(view.waste.totalWastedRs)}
              </div>
              <div className="mt-1.5 text-[13px] text-[var(--ink-muted)]">
                {Math.round(view.waste.shareOfSpend * 100)}% of spend. Clearing the Do-now list is where this comes back.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Opportunity loss: money actively bleeding (wasted + at-risk / fatiguing spend) */}
      {view.opportunity.totalLossRs > 0 && (
        <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
          <div className="mb-1 text-base font-semibold">Opportunity loss</div>
          <div className="mb-4 text-[13px] text-[var(--ink-muted)]">{view.opportunity.basis}</div>
          <div className="flex flex-wrap items-end gap-8 border-t border-[var(--surface-alt)] pt-4">
            <div>
              <div className="text-[30px] font-semibold tabular-nums leading-none text-[var(--bad-ink)]">
                {rupees.format(view.opportunity.totalLossRs)}
              </div>
              <div className="mt-1.5 text-[13px] text-[var(--ink-muted)]">
                {Math.round(view.opportunity.lossShare * 100)}% of spend actively bleeding
              </div>
            </div>
            {view.opportunity.drivers.map((d) => (
              <div key={d.label}>
                <div className="text-[15px] font-semibold tabular-nums">{rupees.format(d.rs)}</div>
                <div className="mt-1 text-[13px] text-[var(--ink-muted)]">{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
