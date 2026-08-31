import { cookies } from "next/headers";
import { loadCockpit, parseDays } from "@/lib/app/cockpit-data";
import { getCurrentUser } from "@/lib/app/user";
import { buildGoogleCockpitData } from "@/lib/google/cockpit";
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
import { CulpritBanner } from "@/components/cockpit/CulpritBanner";
import type { FunnelMetrics } from "@/lib/metrics/funnel-metrics";
import type { DailyPoint } from "@/lib/cockpit/daily-series";
import type { LevelFunnels } from "@/lib/cockpit/level-funnel";
import type { MarginalRead } from "@/lib/scoring/marginal";
import type { DataQuality } from "@/lib/scoring/data-quality";
import type { ScopeTotals } from "@/lib/meta-sync";
import { WhyDrawer } from "@/components/cockpit/WhyDrawer";
import { MetricDrawer, type MetricDisclosure } from "@/components/cockpit/MetricDrawer";
import { rupees } from "@/lib/format";
import { cockpitVerdict } from "@/lib/cockpit/verdict-line";

// The Account Cockpit. Real connected-account data only: if nothing real is
// available, loadCockpit returns connected:false and we render the Connect state.
// No sample or placeholder numbers ever reach this screen.


// The 90-day day-wise cold pull is heavy (up to 100 ads x 90 days); give the background warm enough
// time to finish and populate the cache, or the loader never resolves until the nightly cron warms it.
export const maxDuration = 300;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ days?: string; perf?: string }> }) {
  const { days, perf } = await searchParams;
  const lookback = parseDays(days);

  // Platform selector (Meta / Google / Both). Meta and Google stay SEPARATE sections for now (merged later):
  // "meta" shows the Meta section only, "google" the Google section only, "both" stacks the two. The Meta path
  // is untouched (loadCockpit); Google runs the SAME brain over its own source, badged "Demo data" until the
  // real Google Ads API is wired. Default = meta, so nothing changes for anyone who never touches the selector.
  const platform = (await cookies()).get("adbrain.platform")?.value;
  const showGoogle = platform === "google" || platform === "both";
  const showMeta = platform !== "google";

  const [metaData, googleData] = await Promise.all([
    showMeta ? loadCockpit(lookback) : Promise.resolve(null),
    showGoogle ? getCurrentUser().then((u) => (u ? buildGoogleCockpitData(u.id, lookback) : null)) : Promise.resolve(null),
  ]);

  // Sole-selected-platform empty state -> Connect screen. When BOTH are selected, one platform being empty
  // must NOT block the other, so the connect screen only shows when the empty platform is the only one chosen.
  if (showMeta && !showGoogle && metaData && !metaData.connected) {
    return <ConnectState reason={metaData.reason} errorNote={metaData.errorNote} accountName={metaData.accountName} days={metaData.days} />;
  }
  if (showGoogle && !showMeta && (!googleData || !googleData.connected)) {
    return <ConnectState reason={googleData?.reason ?? "not_connected"} accountName={googleData?.accountName ?? "Google Ads"} days={googleData?.days ?? lookback} />;
  }

  // ?perf=1 surfaces the server-side warm-path breakdown so it can be read in the browser (measure
  // before optimizing). Rendered as machine-readable text; harmless and invisible-ish for normal use.
  const perfEl = perf === "1" && metaData?.connected && metaData.perf ? (
    <pre id="perf-data" data-perf={JSON.stringify(metaData.perf)} className="fixed bottom-1 right-1 z-50 rounded bg-black/80 px-2 py-1 text-[10px] text-white">{JSON.stringify(metaData.perf)}</pre>
  ) : null;

  const sectionLabel = "text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]";

  return (
    <div className="space-y-10">
      {perfEl}
      {showMeta && metaData?.connected ? (
        <section className="space-y-3">
          {showGoogle ? <h2 className={sectionLabel}>Facebook / Instagram</h2> : null}
          <Cockpit view={metaData.view} accountName={metaData.accountName} accountId={metaData.accountId} dateParam={metaData.dateParam} adsAnalyzed={metaData.adsAnalyzed} processed={metaData.processed} funnel={metaData.funnel} marginal={metaData.marginal} dataQuality={metaData.dataQuality} scopeTotals={metaData.scopeTotals} dailySeries={metaData.dailySeries} funnelLevels={metaData.funnelLevels} days={metaData.days} syncedAt={metaData.syncedAt} stale={metaData.stale} />
        </section>
      ) : null}
      {showGoogle && googleData?.connected ? (
        <section className="space-y-3">
          <h2 className={sectionLabel}>Google Ads</h2>
          <Cockpit view={googleData.view} accountName={googleData.accountName} accountId={googleData.accountId} dateParam={googleData.dateParam} adsAnalyzed={googleData.adsAnalyzed} processed={googleData.processed} funnel={googleData.funnel} marginal={googleData.marginal} dataQuality={googleData.dataQuality} scopeTotals={googleData.scopeTotals} dailySeries={googleData.dailySeries} funnelLevels={googleData.funnelLevels} days={googleData.days} syncedAt={googleData.syncedAt} stale={googleData.stale} demo />
        </section>
      ) : null}
    </div>
  );
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

// "synced Xm ago" for the connected line (ISSUE 10): so a day-old cached view can never look live.
// Rendered server-side, so it is relative to the moment the page rendered.
function syncedLabel(iso?: string): string {
  if (!iso) return "";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function Cockpit({ view, accountName, accountId, dateParam, adsAnalyzed, processed, funnel, marginal, dataQuality, scopeTotals, dailySeries, funnelLevels, days, syncedAt, stale, demo }: { view: CockpitView; accountName: string; accountId: string; dateParam: string; adsAnalyzed: number; processed: { campaigns: number; adSets: number; ads: number }; funnel: FunnelMetrics; marginal: MarginalRead; dataQuality: DataQuality; scopeTotals: ScopeTotals; dailySeries: DailyPoint[]; funnelLevels?: LevelFunnels; days: number; syncedAt?: string; stale?: boolean; demo?: boolean }) {
  const health = view.accountHealth;
  // Headline KPIs use the TRUE scope totals (all campaigns/ads of the selected objective),
  // so spend / revenue / ROAS match Ads Manager - not the analyzed-ads subset in view.totals.
  // Fall back to view.totals if scopeTotals is ever absent (old cache shape) so a drift renders
  // numbers instead of throwing (defense-in-depth behind the cache shape guard).
  const totals = scopeTotals ?? view.totals;
  const roas = totals.roas;
  const conc = view.concentration;

  // Confidence-inspectable pillars (measurement canon rule 5): every headline pillar carries an
  // evidence tag + a fetch/formula/logic/example disclosure. The Example is built from THIS
  // account's real numbers (or an honest "not available"), never invented. To extend this to
  // the funnel / scaling / diversity pillars later, add a MetricDisclosure here and render a
  // <MetricDrawer> in that pillar's header - nothing else changes.
  const healthDisclosure: MetricDisclosure = {
    fetch: "Meta Marketing API: per-ad spend, impressions, clicks, purchases, revenue and frequency (day-wise rows).",
    formula: "Spend-weighted mean of each ad's objective score (ROAS for conversion, CTR for traffic and awareness), minus a waste penalty of 25 x wasted-spend share.",
    logic: "One loss-making ad should drag the account down in proportion to the money behind it, so the average is weighted by spend, not by ad count. It is our judgement, corrected from outcomes over time, not a Meta-published grade.",
    example: health.explain.headline, // e.g. "72/100: spend-weighted average ... minus a 6% waste penalty" - real numbers
  };
  const roasDisclosure: MetricDisclosure = {
    fetch: "Meta Marketing API: total revenue and total spend for the selected objective scope and window.",
    formula: "Total revenue / total spend across the window. Null when spend is 0 (never a fabricated ratio).",
    logic: "A raw platform ratio, not a judgement: Meta reports both numbers and we only divide. Blended across the account, so it is a headline, not an ad-level verdict.",
    example:
      roas === null
        ? `Spend is ${rupees.format(totals.spendRs)} for this window, so ROAS is n/a. We never invent a ratio.`
        : `${rupees.format(totals.revenueRs)} revenue / ${rupees.format(totals.spendRs)} spend = ${roas.toFixed(2)}x.`,
  };
  const concShare = conc.status === "ok" ? Math.round(conc.top1Share * 100) : null;
  const concDisclosure: MetricDisclosure = {
    fetch: "Meta Marketing API: per-ad spend across the analyzed ads.",
    formula: "Top ad's spend / total spend.",
    logic: "Pure arithmetic on platform spend facts, no judgement. It flags key-man risk: how much of the account rides on a single creative.",
    example:
      concShare === null
        ? "Not enough spend yet to assess concentration, so no share is shown."
        : `The single top ad takes ${concShare}% of spend; the other ${100 - concShare}% is spread across the rest.`,
  };

  return (
    <div className="space-y-6">
      {/* Context line: coverage of this run (campaigns / ad sets / ads processed) */}
      <div>
        <div className="flex items-center gap-2 text-[13px] text-[var(--ink-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--good-ink)]" />
          <span>{`Connected · ${accountName} · ${processed.campaigns} campaign${processed.campaigns === 1 ? "" : "s"} · ${processed.adSets} ad set${processed.adSets === 1 ? "" : "s"} · ${adsAnalyzed} ads · last ${days} days${syncedAt ? ` · synced ${syncedLabel(syncedAt)}` : ""}`}</span>
          {stale ? <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">refreshing…</span> : null}
          {demo ? <span className="rounded-full bg-[var(--warn-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--warn-ink)]">Demo data</span> : null}
        </div>
        <h1 className="mt-1.5 text-[26px] font-normal tracking-tight">Here&apos;s what to ship this week.</h1>
        <p className="mt-1 max-w-3xl text-[15px] text-[var(--ink)]">
          {cockpitVerdict(
            {
              atStakeRs: view.opportunity.totalLossRs,
              doNowCount: view.doThis.filter((a) => a.priority === "DO_NOW").length,
              winners: view.leaderboard.filter((a) => a.verdict === "winner").length,
              fatiguing: view.atRiskContributors.length,
            },
            rupees.format,
          )}
        </p>
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
              <MetricDrawer title="Account Health" tier="Y" disclosure={healthDisclosure} />
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
          disclosure={<MetricDrawer title="Blended ROAS" tier="A" disclosure={roasDisclosure} />}
        />
        <KpiCard
          label="Concentration"
          tip="Share of spend on the single top ad. Internal calculation over your account."
          value={conc.status === "ok" ? `${Math.round(conc.top1Share * 100)}%` : undefined}
          insufficient={conc.status === "ok" ? undefined : "Not enough spend to assess"}
          sub={conc.status === "ok" ? "top ad share of spend" : undefined}
          disclosure={<MetricDrawer title="Concentration" tier="A" disclosure={concDisclosure} />}
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
      <FunnelCard funnel={funnel} dailySeries={dailySeries} funnelLevels={funnelLevels} />

      {/* Why-results-dropped diagnostic: names a paused/ended campaign as the cause (never as a to-do) */}
      <CulpritBanner dailySeries={dailySeries} funnelLevels={funnelLevels} accountId={accountId} />

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
