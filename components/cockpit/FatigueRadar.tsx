// Fatigue radar. State per ad is read off the real verdict (winner=Healthy,
// refresh=Fatiguing, do_not_kill_yet=Watch, loser=Fatigued), see FATIGUE_STATE.
// The timed 7/14-day probability the full design shows needs spend-response history
// the CockpitView does not carry, so that horizon is shown as insufficient_data
// rather than a fabricated percentage.
import type { CockpitAd } from "@/lib/cockpit/analyze";
import { FATIGUE_STATE } from "./styles";

export function FatigueRadar({ ads }: { ads: CockpitAd[] }) {
  const rows = ads.slice(0, 5);
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-base font-semibold">Fatigue radar &amp; 7 / 14-day forecast</div>
        <span className="shrink-0 rounded-[70px] border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">
          MODEL_ESTIMATE
        </span>
      </div>
      <div className="mb-3 text-[13px] text-[var(--ink-muted)]">
        State from the verdict engine. The timed forecast needs more history.
      </div>
      <div>
        {rows.map((ad) => {
          const s = FATIGUE_STATE[ad.verdict];
          return (
            <div
              key={ad.id}
              className="flex items-center justify-between gap-3 border-t border-[var(--surface-alt)] py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{ad.name}</span>
                  <span className={`shrink-0 rounded-[70px] px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                </div>
                <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">
                  {ad.why[0] ?? "7 / 14-day forecast"} · insufficient_data
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="border-t border-[var(--surface-alt)] py-3 text-sm text-[var(--ink-muted)]">
            No ads assessed yet.
          </div>
        )}
      </div>
    </div>
  );
}
