// "This week's plan" the ranked action queue, straight from view.doThis (already
// sorted by priority upstream). Each row is joined to its real CockpitAd so the row
// carries a real confidence bar and the engine's Scale / Iterate / Kill verdict chip,
// matching the design's ranked test-plan list. No fabricated ordering or metrics.
import type { CockpitAction, CockpitAd, Verdict } from "@/lib/cockpit/analyze";
import { VERDICT_STYLE } from "./styles";
import { AdLink } from "./AdLink";

type PlanItem = CockpitAction & { adId: string; adName: string };

function confColor(v: Verdict): string {
  return v === "winner" ? "bg-[var(--good-ink)]" : v === "loser" ? "bg-[var(--bad-ink)]" : "bg-[var(--warn-ink)]";
}

export function ActionList({ items, ads, accountId }: { items: PlanItem[]; ads: CockpitAd[]; accountId?: string }) {
  const byId = new Map(ads.map((a) => [a.id, a]));

  if (items.length === 0) {
    return (
      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6 text-sm text-[var(--ink-muted)]">
        No actions this week. Every ad the engine assessed is holding steady.
      </div>
    );
  }
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">This week&apos;s ranked plan</div>
          <div className="text-[13px] text-[var(--ink-muted)]">Ranked by priority · what to ship first</div>
        </div>
        <span className="shrink-0 rounded-[70px] bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
          {items.filter((a) => a.priority === "DO_NOW").length} do-now
        </span>
      </div>
      <div>
        {items.map((a, i) => {
          const ad = byId.get(a.adId);
          const conf = ad ? Math.round(ad.confidence * 100) : null;
          const v = ad ? VERDICT_STYLE[ad.verdict] : VERDICT_STYLE[a.priority === "DO_NOW" ? "loser" : "do_not_kill_yet"];
          return (
            <div
              key={`${a.adId}-${i}`}
              className="grid grid-cols-[24px_1fr_auto] items-center gap-3 border-t border-[var(--surface-alt)] py-3.5"
            >
              <span className="text-[13px] font-semibold text-[var(--ink-muted)] tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <AdLink accountId={accountId} adId={a.adId} name={a.adName} className="truncate text-sm font-medium" />
                  {ad && (
                    <span className="shrink-0 rounded-[70px] border border-[var(--hairline)] bg-[var(--bg)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">
                      {ad.objective}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {conf !== null && (
                    <>
                      <div className="h-1.5 w-full max-w-[180px] overflow-hidden rounded-[70px] bg-[var(--surface-alt)]">
                        <div className={`h-full rounded-[70px] ${ad ? confColor(ad.verdict) : "bg-[var(--ink-muted)]"}`} style={{ width: `${conf}%` }} />
                      </div>
                      <span className="shrink-0 text-xs text-[var(--ink-muted)] tabular-nums">{conf}% confidence</span>
                    </>
                  )}
                  {conf === null && <span className="truncate text-[13px] text-[var(--ink-muted)]">{a.why}</span>}
                </div>
              </div>
              <span className={`shrink-0 rounded-[70px] px-3 py-1 text-xs font-semibold ${v.cls}`}>{v.label}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-[var(--ink-muted)]">
        Nothing is applied automatically. You make each change in your ad account.
      </p>
    </div>
  );
}
