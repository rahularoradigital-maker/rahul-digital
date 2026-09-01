"use client";
// "This week's plan" the ranked action queue, straight from view.doThis (already
// sorted by priority upstream). Each row is joined to its real CockpitAd so the row
// carries a real confidence bar and the engine's Scale / Iterate / Kill verdict chip,
// matching the design's ranked test-plan list. No fabricated ordering or metrics.
import type { CockpitAction, CockpitAd } from "@/lib/cockpit/analyze";
import { fatigueToContract } from "@/lib/intelligence/from-fatigue";
import { ReasoningTrace } from "@/components/intelligence/ReasoningTrace";
import type { AdJudgment } from "@/lib/judgment/agent";
import { VERDICT_STYLE, confColor } from "./styles";
import { AdLink } from "./AdLink";
import { ObjectiveMeta } from "./ObjectiveMeta";
import { CollapsibleRows } from "./CollapsibleRows";
import { ObjectiveCardSelect } from "./ObjectiveCardSelect";
import { rupees } from "@/lib/format";
import { useState } from "react";

type PlanItem = CockpitAction & { adId: string; adName: string; moneyAtStakeRs: number };

// The Triple-Labelled Decision, shown inline so a buyer sees WHY to trust (or distrust) the verdict at a
// glance: is it judgeable at all (Evidence), do the independent signals agree (Agreement), how sure
// (Confidence). When an ad is not judgeable - e.g. it spent too little of its ad set to read fatigue - the
// card says so plainly instead of asserting a fatigue/kill verdict on noise.
const chip = "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium";
function TripleLabel({ j }: { j: AdJudgment }) {
  const ev = j.evidence.judgeable;
  const t = j.confidence.tier;
  const tierCls = t === "high" ? "bg-[var(--good-bg)] text-[var(--good-ink)]" : t === "med" ? "bg-[var(--warn-bg)] text-[var(--warn-ink)]" : "bg-[var(--surface-alt)] text-[var(--ink-muted)]";
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1" title="Triple-Labelled Decision: three independent checks stand behind this verdict">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Judged</span>
      <span className={`${chip} ${ev ? "bg-[var(--good-bg)] text-[var(--good-ink)]" : "bg-[var(--bad-bg)] text-[var(--bad-ink)]"}`}>{ev ? "Evidence ✓" : "Not judgeable"}</span>
      {ev && <span className={`${chip} border border-[var(--hairline)] bg-[var(--bg)] text-[var(--ink-muted)] tabular-nums`}>{j.agreement.agree}/{j.agreement.of} agree</span>}
      {ev && <span className={`${chip} ${tierCls}`}>Conf {t === "high" ? "High" : t === "med" ? "Med" : "Low"}</span>}
      {!ev && j.evidence.blockingReason && <span className="text-[11px] text-[var(--ink-muted)]">{j.evidence.blockingReason}</span>}
    </div>
  );
}

export function ActionList({ items, ads, accountId, dateParam }: { items: PlanItem[]; ads: CockpitAd[]; accountId?: string; dateParam?: string }) {
  const byId = new Map(ads.map((a) => [a.id, a]));
  // Per-card objective filter (client-side over the already-loaded rows): the distinct objectives present in
  // this card, and the rows narrowed to the picked one - so a buyer can rectify one objective at a time,
  // independent of the global topbar filter. No new query (§83).
  const [obj, setObj] = useState("all");
  const objectives = [...new Set(items.map((i) => byId.get(i.adId)?.objective as string | undefined).filter((o): o is string => !!o))];
  const shown = obj === "all" ? items : items.filter((i) => (byId.get(i.adId)?.objective as string | undefined) === obj);

  if (items.length === 0) {
    return (
      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6 text-sm text-[var(--ink-muted)]">
        No actions this week. Every ad the engine assessed is holding steady.
      </div>
    );
  }
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-normal">This week&apos;s ranked plan</div>
          <div className="text-[13px] text-[var(--ink-muted)]">Ranked by money at stake · biggest first</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ObjectiveCardSelect objectives={objectives} value={obj} onChange={setObj} />
          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            {shown.filter((a) => a.priority === "DO_NOW").length} do-now
          </span>
        </div>
      </div>
      <div>
        <CollapsibleRows initial={8} noun="ads">
        {shown.map((a, i) => {
          const ad = byId.get(a.adId);
          const conf = ad ? Math.round(ad.confidence * 100) : null;
          const v = ad ? VERDICT_STYLE[ad.verdict] : VERDICT_STYLE[a.priority === "DO_NOW" ? "loser" : "do_not_kill_yet"];
          // Every verdict carries its reason: the action's own why, falling back to the engine's
          // first signal. So even a "Hold" tells the user WHY it is holding, in light text.
          const reason = a.why || ad?.why?.[0];
          return (
            <div
              key={`${a.adId}-${i}`}
              className="grid grid-cols-[22px_1fr] gap-x-3 border-t border-[var(--surface-alt)] py-3.5"
            >
              <span className="pt-0.5 text-[13px] font-semibold text-[var(--ink-muted)] tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                {/* Line 1: ad name (truncates) + the verdict badge, always on their own line so they never collide */}
                <div className="flex items-center justify-between gap-2">
                  <AdLink accountId={accountId} adId={a.adId} adSetId={ad?.adSetId} campaignId={ad?.campaignId} name={a.adName} className="min-w-0 truncate text-sm font-medium" dateParam={dateParam} />
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${v.cls}`}>{v.label}</span>
                </div>
                {/* Line 2: every action carries its campaign objective + current ROAS + whether results trend up or down */}
                {ad && <ObjectiveMeta ad={ad} className="mt-1.5" />}
                {/* Line 2b: money at stake + confidence, wraps instead of overlapping */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  {a.moneyAtStakeRs > 0 && (
                    <span className="shrink-0 rounded-full bg-[var(--bad-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--bad-ink)] tabular-nums">
                      {rupees.format(a.moneyAtStakeRs)} at stake
                    </span>
                  )}
                  {conf !== null && (
                    <div className="flex min-w-[120px] flex-1 items-center gap-2">
                      <div className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-[var(--surface-alt)]">
                        <div className={`h-full rounded-full ${ad ? confColor(ad.verdict) : "bg-[var(--ink-muted)]"}`} style={{ width: `${conf}%` }} />
                      </div>
                      <span className="shrink-0 text-xs text-[var(--ink-muted)] tabular-nums">{conf}%</span>
                    </div>
                  )}
                </div>
                {/* Line 2.5: the Triple-Labelled Decision - Evidence x Agreement x Confidence behind the verdict */}
                {ad?.judgment && <TripleLabel j={ad.judgment} />}
                {/* Line 3: WHY - context for the verdict, always shown in light text so nothing is asserted without a reason */}
                {reason && <div className="mt-1.5 text-[13px] leading-snug text-[var(--ink-muted)]">&#8627; {reason}</div>}
                {/* Line 4: the full §110 reasoning behind this action (DATA->...->LEARNING), computed from the ad - no new query. */}
                {ad && (() => { const c = fatigueToContract(ad); return c ? <ReasoningTrace contract={c} /> : null; })()}
              </div>
            </div>
          );
        })}
        </CollapsibleRows>
      </div>
      <p className="mt-3 text-xs text-[var(--ink-muted)]">
        Nothing is applied automatically. You make each change in your ad account.
      </p>
    </div>
  );
}
