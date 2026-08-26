// "This week's plan" — the ranked action queue. Straight from view.doThis (already
// sorted by priority upstream). Priority chips carry the telli DO NOW / DO NEXT /
// WATCH semantics. No fabricated ordering or metrics.
import type { CockpitAction, Priority } from "@/lib/cockpit/analyze";
import { PRIORITY_STYLE } from "./styles";

type PlanItem = CockpitAction & { adId: string; adName: string };

export function ActionList({ items }: { items: PlanItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6 text-sm text-[var(--ink-muted)]">
        No actions this week. Every ad the engine assessed is holding steady.
      </div>
    );
  }
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-base font-semibold">This week&apos;s plan</div>
          <div className="text-[13px] text-[var(--ink-muted)]">Ranked by priority · what to ship first</div>
        </div>
        <span className="rounded-[70px] bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
          {items.filter((a) => a.priority === "DO_NOW").length} do-now
        </span>
      </div>
      <div>
        {items.map((a, i) => {
          const p = PRIORITY_STYLE[a.priority as Priority];
          return (
            <div
              key={`${a.adId}-${i}`}
              className="grid grid-cols-[24px_1fr_auto] items-center gap-3 border-t border-[var(--surface-alt)] py-3.5"
            >
              <span className="text-[13px] font-semibold text-[var(--ink-muted)] tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium">{a.label}</div>
                <div className="mt-1 truncate text-[13px] text-[var(--ink-muted)]">
                  {a.adName} &middot; {a.why}
                </div>
              </div>
              <span className={`rounded-[70px] px-3 py-1 text-xs font-semibold ${p.cls}`}>{p.label}</span>
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
