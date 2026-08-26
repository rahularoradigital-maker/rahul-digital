import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchLiveCockpit } from "@/lib/meta-sync";
import { analyzeAccount, type CockpitView, type Verdict } from "@/lib/cockpit/analyze";
import { SAMPLE_ADS } from "@/lib/sample/account";
import { HealthRing } from "@/components/cockpit/HealthRing";
import { HealthComposition, type CompositionRow } from "@/components/cockpit/HealthComposition";
import { KpiCard } from "@/components/cockpit/KpiCard";
import { ActionList } from "@/components/cockpit/ActionList";
import { FatigueRadar } from "@/components/cockpit/FatigueRadar";
import { Leaderboard } from "@/components/cockpit/Leaderboard";

// The account cockpit. Shows REAL data from the user's connected Meta account (no dummy
// data). If nothing is connected yet, it shows a Connect screen instead.

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const live = await fetchLiveCockpit(user.id);

  // Not connected yet: render the FULL designed cockpit populated with a sample account,
  // clearly labelled as a preview, above a Connect banner. This shows the real design
  // before any account is linked; live data replaces it the moment Meta is connected.
  if (live.status === "not_connected" || live.status === "error") {
    const sample = analyzeAccount(SAMPLE_ADS);
    return (
      <div className="space-y-6">
        <ConnectBanner error={live.status === "error" ? live.message : undefined} />
        <Cockpit view={sample} accountName="Sample preview" adsAnalyzed={SAMPLE_ADS.length} preview />
      </div>
    );
  }

  return <Cockpit view={live.view} accountName={live.accountName} adsAnalyzed={live.adsAnalyzed} />;
}

function ConnectBanner({ error }: { error?: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[10px] border border-[var(--accent)] bg-[var(--accent-soft)] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-semibold text-[var(--ink)]">This is a sample preview.</div>
        <div className="mt-0.5 text-sm text-[var(--ink-muted)]">
          Connect your Meta account to replace it with your real ads. Nothing is ever changed automatically.
          {error ? ` (Last sync note: ${error})` : ""}
        </div>
      </div>
      <a
        href="/api/connect/meta/authorize"
        className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--ink)] px-6 py-2.5 font-medium text-white transition hover:opacity-90"
      >
        Connect Meta
      </a>
    </div>
  );
}

// Share of total spend sitting on each verdict, a real, honest breakdown of where the
// Account Health score comes from (leaderboard verdicts + view.totals), not fabricated
// component scores.
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

function Cockpit({ view, accountName, adsAnalyzed, preview }: { view: CockpitView; accountName: string; adsAnalyzed: number; preview?: boolean }) {
  const health = view.accountHealth;
  const roas = view.totals.roas;
  const conc = view.concentration;

  return (
    <div className="space-y-6">
      {/* Context line */}
      <div>
        <div className="flex items-center gap-2 text-[13px] text-[var(--ink-muted)]">
          <span className={`h-1.5 w-1.5 rounded-full ${preview ? "bg-[var(--warn-ink)]" : "bg-[var(--good-ink)]"}`} />
          {preview
            ? `Sample preview · ${adsAnalyzed} example ads · last 30 days`
            : `Live · ${accountName} · ${adsAnalyzed} real ads · last 30 days`}
        </div>
        <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight">Here&apos;s what to ship this week.</h1>
      </div>

      {/* Account Health */}
      <div className="grid grid-cols-1 items-center gap-8 rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6 md:grid-cols-[200px_1fr]">
        <HealthRing score={health.score} />
        <div>
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <div className="text-base font-semibold">Account Health</div>
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
        <ActionList items={view.doThis} ads={view.leaderboard} />
        <FatigueRadar ads={view.leaderboard} />
      </div>

      {/* Creative leaderboard */}
      <Leaderboard ads={view.leaderboard} rupees={rupees} />

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
    </div>
  );
}
