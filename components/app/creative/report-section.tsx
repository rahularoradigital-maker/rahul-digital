import { ConnectState } from "@/components/app/connect-state";
import type { CockpitData } from "@/lib/app/cockpit-data";
import { buildCreativeReport, pickBestWorst, type AdBrief } from "@/lib/creative/creative-report";
import { CreativeReportCard } from "@/components/app/creative/creative-report-card";
import { AdLink } from "@/components/cockpit/AdLink";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function BestWorst({ best, worst, accountId, dateParam }: { best: AdBrief | null; worst: AdBrief | null; accountId?: string; dateParam?: string }) {
  if (!best && !worst) return null;
  const col = (a: AdBrief | null, label: string, tone: "good" | "bad") =>
    a ? (
      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--bg)] p-4">
        <div className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${tone === "good" ? "text-[var(--good-ink)]" : "text-[var(--bad-ink)]"}`}>{label}</div>
        <div className="text-[14px] font-semibold"><AdLink accountId={accountId} adId={a.id} name={a.name} className="truncate" dateParam={dateParam} /></div>
        <div className="mt-1 text-[12px] text-[var(--ink-muted)] tabular-nums">CreativeScore {a.score.toFixed(0)}/100 · {inr.format(a.spendRs)} spent{a.fatigueState ? ` · ${a.fatigueState}` : ""}</div>
        <div className="mt-1 text-[12px] text-[var(--ink)]">{a.actionLabel}</div>
      </div>
    ) : (
      <div className="rounded-[10px] border border-dashed border-[var(--hairline)] bg-[var(--surface)] p-4 text-[13px] text-[var(--ink-muted)]">{tone === "good" ? "No clear winner yet." : "Nothing clearly fading."}</div>
    );
  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
      <div className="mb-1 text-base font-normal">Best vs worst right now</div>
      <div className="mb-4 text-[13px] text-[var(--ink-muted)]">Your clearest winner against the ad most in need of a refresh - where to lean in and where to act.</div>
      <div className="grid gap-4 sm:grid-cols-2">
        {col(best, "Working best", "good")}
        {col(worst, "Fading fastest", "bad")}
      </div>
    </div>
  );
}

// Assembles the creative health report from numbers the cockpit already computed (no new data, no AI) and
// hands it to the client card to render + download. Not connected -> the shared Connect state.
export function ReportSection({ data, deepReadCount = 0 }: { data: CockpitData; deepReadCount?: number }) {
  if (!data.connected) {
    return <ConnectState reason={data.reason} errorNote={data.errorNote} accountName={data.accountName} days={data.days} />;
  }
  const v = data.view;
  const lb = v.leaderboard;
  const report = buildCreativeReport({
    accountName: data.accountName,
    days: data.days,
    healthScore: v.accountHealth?.score ?? null,
    adsAssessed: lb.length,
    fatiguing: lb.filter((a) => a.verdict === "refresh" || a.verdict === "loser").length,
    winners: lb.filter((a) => a.verdict === "winner").length,
    top1SharePct: v.concentration?.status === "ok" ? Math.round(v.concentration.top1Share * 100) : null,
    dominantFormat: data.ownDiversity?.dimensions.find((d) => d.dimension === "format")?.buckets[0]?.name ?? null,
    wasteRs: v.waste?.status === "ok" ? v.waste.totalWastedRs : null,
    opportunityLossRs: v.opportunity?.totalLossRs ?? null,
    deepReadCount,
  });

  const briefs: AdBrief[] = lb.map((a) => ({ id: a.id, name: a.name, score: a.score, verdict: a.verdict, spendRs: a.spendRs, fatigueState: a.fatigueRead?.state ?? null, actionLabel: a.action.label }));
  const { best, worst } = pickBestWorst(briefs);

  return (
    <div className="space-y-6">
      <CreativeReportCard report={report} />
      <BestWorst best={best} worst={worst} accountId={data.accountId} dateParam={data.dateParam} />
    </div>
  );
}
