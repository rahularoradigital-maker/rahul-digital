import { loadCockpit, parseDays } from "@/lib/app/cockpit-data";
import { ConnectState } from "@/components/app/connect-state";
import { type CockpitView, type Verdict, type SpendContributor } from "@/lib/cockpit/analyze";
import { AdLink } from "@/components/cockpit/AdLink";
import { HealthRing } from "@/components/cockpit/HealthRing";
import { HealthComposition, type CompositionRow } from "@/components/cockpit/HealthComposition";
import { KpiCard } from "@/components/cockpit/KpiCard";
import { ActionList } from "@/components/cockpit/ActionList";
import { FatigueRadar } from "@/components/cockpit/FatigueRadar";
import { Leaderboard } from "@/components/cockpit/Leaderboard";
import { FunnelCard } from "@/components/cockpit/FunnelCard";
import type { FunnelMetrics } from "@/lib/metrics/funnel-metrics";
import type { MarginalRead } from "@/lib/scoring/marginal";
import type { DataQuality } from "@/lib/scoring/data-quality";
import type { ScopeTotals } from "@/lib/meta-sync";
import { WhyDrawer } from "@/components/cockpit/WhyDrawer";
import { rupees } from "@/lib/format";

// The Account Cockpit. Real connected-account data only: if nothing real is
// available, loadCockpit returns connected:false and we render the Connect state.
// No sample or placeholder numbers ever reach this screen.


export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days } = await searchParams;
  const data = await loadCockpit(parseDays(days));

  if (!data.connected) {
    return <ConnectState reason={data.reason} errorNote={data.errorNote} accountName={data.accountName} days={data.days} />;
  }

  return <Cockpit view={data.view} accountName={data.accountName} accountId={data.accountId} dateParam={data.dateParam} adsAnalyzed={data.adsAnalyzed} processed={data.processed} funnel={data.funnel} marginal={data.marginal} dataQuality={data.dataQuality} scopeTotals={data.scopeTotals} days={data.days} />;
}

// Honest confidence de-rating: when the day-wise series has quality problems (thin
// sample, spend shock, pause gap, tracking gap) we say so and show how much the
// scores below are being trusted, rather than presenting a shaky read as certain.
const DQ_SEVERITY_STYLE: Record<"info" | "warning" | "critical", string> = {
  info: "bg-[var(--surface-alt)] text-[var(--ink-muted)]",
  warning: "bg-[var(--warn-bg)] text-[var(--warn-ink)]",
  critical: "bg-[var(--bad-bg)] text-[var(--bad-ink)]",
};

function ConfidenceBanner({ dq }: { dq: DataQuality }) {
  if (dq.flags.length === 0) return null;
  const worst = dq.flags.some((f) => f.severity === "critical") ? "critical" : dq.flags.some((f) => f.severity === "warning") ? "warning" : "info";
  const border = worst === "critical" ? "border-[var(--bad-ink)]" : worst === "warning" ? "border-[var(--warn-ink)]" : "border-[var(--hairline)]";
  return (
    <div className={`rounded-[10px] border ${border} bg-[var(--surface)] p-4`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-normal">{dq.reliable ? "Read with some caution" : "Low-confidence data"}</span>
        <span className="rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">
          confidence de-rated {Math.round(dq.confidencePenalty * 100)}% · {dq.days} days
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {dq.flags.map((f) => (
          <span key={f.code} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${DQ_SEVERITY_STYLE[f.severity]}`}>
            {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const MARGINAL_STYLE: Record<MarginalRead["classification"], { label: string; cls: string }> = {
  UNDERFUNDED: { label: "Underfunded - room to scale", cls: "bg-[var(--good-bg)] text-[var(--good-ink)]" },
  HEALTHY: { label: "Healthy", cls: "bg-[var(--good-bg)] text-[var(--good-ink)]" },
  APPROACHING_SATURATION: { label: "Approaching saturation", cls: "bg-[var(--warn-bg)] text-[var(--warn-ink)]" },
  SATURATED: { label: "Saturated - diminishing returns", cls: "bg-[var(--bad-bg)] text-[var(--bad-ink)]" },
  UNKNOWN: { label: "Not enough data", cls: "bg-[var(--surface-alt)] text-[var(--ink-muted)]" },
};

// The exact ads behind a money-bleeding total, with the calculation, so the headline rupee
// figure is always traceable (never an unexplained number). Each row links to that ad in Ads
// Manager (campaign -> ad set -> ad selected), so "where exactly" is one click away.
function ContributorList({ items, accountId, dateParam, kind }: { items: SpendContributor[]; accountId: string; dateParam: string; kind: "waste" | "risk" }) {
  if (!items || items.length === 0) return null; // guard undefined (old cache shape) so it never throws
  return (
    <div className="mt-4 border-t border-[var(--surface-alt)] pt-3.5">
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        {kind === "waste" ? "Which ads (and the math)" : "Which ads are at risk (and why)"}
      </div>
      <div className="space-y-2.5">
        {items.map((c) => (
          <div key={c.adId} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <AdLink accountId={accountId} adId={c.adId} adSetId={c.adSetId} campaignId={c.campaignId} name={c.name} className="block truncate text-[13px] font-medium" dateParam={dateParam} />
              {(c.campaignName || c.adsetName) && (
                <div className="truncate text-[11px] text-[var(--ink-muted)]">
                  {[c.campaignName, c.adsetName].filter(Boolean).join(" · ")}
                </div>
              )}
              <div className="mt-0.5 text-[11px] text-[var(--ink-muted)] tabular-nums">
                {kind === "waste"
                  ? `${c.roas === null ? "n/a" : `${c.roas.toFixed(2)}x`} ROAS on ${rupees.format(c.spendRs)} spent - below 1x break-even`
                  : `${c.fatigueState ?? "fatiguing"} · ${c.roas === null ? "n/a" : `${c.roas.toFixed(2)}x`} ROAS · ${rupees.format(c.spendRs)} still spending`}
              </div>
            </div>
            <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--bad-ink)]">{rupees.format(c.amountRs)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScalingCard({ marginal }: { marginal: MarginalRead }) {
  const s = MARGINAL_STYLE[marginal.classification];
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-base font-normal">Scaling headroom</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
        <span className="rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">
          {marginal.label} · {Math.round(marginal.confidence * 100)}% conf
        </span>
      </div>
      <div className="text-[13px] text-[var(--ink-muted)]">
        {marginal.why[0] ?? "Modelled from the day-wise spend-to-revenue relationship."}
        {marginal.marginalRoas !== null && marginal.currentRoas !== null && (
          <>
            {" "}Marginal ROAS on the next increment: <span className="font-medium text-[var(--ink)]">{marginal.marginalRoas.toFixed(2)}x</span> vs{" "}
            {marginal.currentRoas.toFixed(2)}x current.
          </>
        )}
      </div>
    </div>
  );
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

function Cockpit({ view, accountName, accountId, dateParam, adsAnalyzed, processed, funnel, marginal, dataQuality, scopeTotals, days }: { view: CockpitView; accountName: string; accountId: string; dateParam: string; adsAnalyzed: number; processed: { campaigns: number; adSets: number; ads: number }; funnel: FunnelMetrics; marginal: MarginalRead; dataQuality: DataQuality; scopeTotals: ScopeTotals; days: number }) {
  const health = view.accountHealth;
  // Headline KPIs use the TRUE scope totals (all campaigns/ads of the selected objective),
  // so spend / revenue / ROAS match Ads Manager - not the analyzed-ads subset in view.totals.
  // Fall back to view.totals if scopeTotals is ever absent (old cache shape) so a drift renders
  // numbers instead of throwing (defense-in-depth behind the cache shape guard).
  const totals = scopeTotals ?? view.totals;
  const roas = totals.roas;
  const conc = view.concentration;

  return (
    <div className="space-y-6">
      {/* Context line: coverage of this run (campaigns / ad sets / ads processed) */}
      <div>
        <div className="flex items-center gap-2 text-[13px] text-[var(--ink-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--good-ink)]" />
          {`Connected · ${accountName} · ${processed.campaigns} campaign${processed.campaigns === 1 ? "" : "s"} · ${processed.adSets} ad set${processed.adSets === 1 ? "" : "s"} · ${adsAnalyzed} ads · last ${days} days`}
        </div>
        <h1 className="mt-1.5 text-[26px] font-normal tracking-tight">Here&apos;s what to ship this week.</h1>
      </div>

      {/* Data-quality de-rating: honest confidence note when the series is thin or broken */}
      <ConfidenceBanner dq={dataQuality} />

      {/* Account Health */}
      <div className="grid grid-cols-1 items-center gap-8 rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6 md:grid-cols-[200px_1fr]">
        <HealthRing score={health.score} />
        <div>
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="text-base font-normal">Account Health</div>
              <WhyDrawer explanation={view.accountHealth.explain} />
            </div>
            <span className="rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">
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
          sub={`${rupees.format(totals.revenueRs)} on ${rupees.format(totals.spendRs)}`}
        />
        <KpiCard
          label="Concentration"
          tip="Share of spend on the single top ad. Internal calculation over your account."
          value={conc.status === "ok" ? `${Math.round(conc.top1Share * 100)}%` : undefined}
          insufficient={conc.status === "ok" ? undefined : "Not enough spend to assess"}
          sub={conc.status === "ok" ? "top ad share of spend" : undefined}
        />
        {/* MER + nCAC need store revenue (Shopify), so they are always insufficient until a revenue
            source connects. Collapse the two permanently-dead cards into one honest affordance
            spanning both slots instead of two decoy tiles. Restore as real cards with plan-04. */}
        <div className="col-span-2 flex flex-col justify-center rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
          <div className="mb-1 text-[13px] font-medium text-[var(--ink-muted)]">Store economics · MER &amp; nCAC</div>
          <div className="text-[13px] text-[var(--ink)]">
            Connect Shopify to unlock marketing-efficiency ratio (revenue ÷ spend) and new-customer acquisition cost.
          </div>
        </div>
      </div>

      {/* Scaling headroom (marginal economics) + ad-level funnel metrics */}
      <ScalingCard marginal={marginal} />
      <FunnelCard funnel={funnel} />

      {/* This week's plan + Fatigue radar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <ActionList items={view.doThis} ads={view.leaderboard} accountId={accountId} dateParam={dateParam} />
        <FatigueRadar ads={view.leaderboard} halfLife={view.creativeHalfLife} accountId={accountId} dateParam={dateParam} />
      </div>

      {/* Creative leaderboard */}
      <Leaderboard ads={view.leaderboard} rupees={rupees} accountId={accountId} dateParam={dateParam} />

      {/* Wasted spend */}
      {view.waste.status === "ok" && (
        <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
          <div className="mb-1 text-base font-normal">Budget waste</div>
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
          <ContributorList items={view.wasteContributors} accountId={accountId} dateParam={dateParam} kind="waste" />
        </div>
      )}

      {/* Opportunity loss: money actively bleeding (wasted + at-risk / fatiguing spend) */}
      {view.opportunity.totalLossRs > 0 && (
        <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
          <div className="mb-1 text-base font-normal">Opportunity loss</div>
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
          <ContributorList items={view.atRiskContributors} accountId={accountId} dateParam={dateParam} kind="risk" />
        </div>
      )}
    </div>
  );
}
