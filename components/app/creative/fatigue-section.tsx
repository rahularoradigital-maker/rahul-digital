import { ConnectState } from "@/components/app/connect-state";
import type { CockpitData } from "@/lib/app/cockpit-data";
import type { CockpitAd } from "@/lib/cockpit/analyze";
import { FATIGUE_STATE, PRIORITY_STYLE } from "@/components/cockpit/styles";
import { AdLink } from "@/components/cockpit/AdLink";

// Creative Fatigue (Rulebook 5.1). The fatigue READ for every ad comes straight off
// the verdict engine's real output (winner/refresh/do_not_kill_yet/loser -> Healthy/
// Fatiguing/Watch/Fatigued, see FATIGUE_STATE) - never a re-derived number.
//
// HONEST GATE: a precise fatigue percentage and a half-life "death date" (5.1) need
// per-ad delivery history (impressions/day, frequency) the current CockpitView does
// not expose. So no timed forecast, date, or percentage is fabricated here - every
// row says plainly that it needs more delivery history.

export function FatigueSection({ data, days }: { data: CockpitData; days: number }) {
  if (!data.connected) {
    return <ConnectState reason={data.reason} errorNote={data.errorNote} accountName={data.accountName} days={data.days} />;
  }

  return <FatigueList ads={data.view.leaderboard} accountName={data.accountName} accountId={data.accountId} dateParam={data.dateParam} days={days} />;
}

function FatigueList({ ads, accountName, accountId, dateParam, days }: { ads: CockpitAd[]; accountName: string; accountId?: string; dateParam?: string; days: number }) {
  // Worst first: ascending CreativeScore puts the fatiguing/fatigued ads at the top.
  const sorted = [...ads].sort((a, b) => a.score - b.score);
  const atRisk = ads.filter((a) => a.verdict === "refresh" || a.verdict === "loser").length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[13px] text-[var(--ink-muted)]">
          <span className={`h-1.5 w-1.5 rounded-full ${atRisk > 0 ? "bg-[var(--warn-ink)]" : "bg-[var(--good-ink)]"}`} />
          {`${accountName} · ${ads.length} ads assessed · last ${days} days`}
        </div>
        <h1 className="mt-1.5 text-[26px] font-normal tracking-tight">
          {ads.length === 0
            ? "No ads assessed yet."
            : atRisk === 0
              ? "Nothing is fatiguing right now."
              : `${atRisk} of ${ads.length} ad${ads.length === 1 ? "" : "s"} ${atRisk === 1 ? "is" : "are"} fatiguing or fatigued.`}
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--ink-muted)]">
          Read off the real verdict engine, sorted worst first by CreativeScore.
        </p>
      </div>

      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-4 text-[13px] text-[var(--ink-muted)]">
        A precise fatigue percentage and a half-life death date need per-ad delivery history (impressions per day,
        frequency) this account does not expose yet. Needs more delivery history - never a fabricated date or percentage.
      </div>

      <div className="overflow-hidden rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)]">
        {sorted.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ink-muted)]">No ads assessed yet.</div>
        ) : (
          <div className="px-6 pb-2 pt-2">
            {sorted.map((ad) => {
              const fatigue = FATIGUE_STATE[ad.verdict];
              const action = PRIORITY_STYLE[ad.action.priority];
              const conf = Math.round(ad.confidence * 100);
              return (
                <div key={ad.id} className="border-t border-[var(--surface-alt)] py-4 first:border-t-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <AdLink accountId={accountId} adId={ad.id} name={ad.name} className="truncate text-[15px] font-semibold" dateParam={dateParam} />
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${fatigue.cls}`}>
                        {fatigue.label}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-xs text-[var(--ink-muted)] tabular-nums">
                      <span>CreativeScore {ad.score.toFixed(0)}/100</span>
                      <span>{conf}% conf</span>
                    </div>
                  </div>

                  {ad.why.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {ad.why.map((w, i) => (
                        <li key={i} className="truncate text-xs text-[var(--ink-muted)]">
                          &#8627; {w}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-[var(--ink-muted)]">Needs more delivery history for a timed forecast</span>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${action.cls}`}>
                      {ad.action.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
