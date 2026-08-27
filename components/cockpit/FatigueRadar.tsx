// Creative half-life & fatigue radar. Everything here is the REAL day-wise fatigue read
// (lib/scoring/fatigue): per-ad state, fatigue index, days-to-fatigue (the creative's
// half-life), and the day-wise evidence behind it. The account half-life is the spend-
// weighted median. Ads without enough daily history say so honestly - no fabricated number.
import type { CockpitAd, CreativeHalfLife } from "@/lib/cockpit/analyze";
import type { FatigueState } from "@/lib/scoring/fatigue";
import { AdLink } from "./AdLink";

const STATE_STYLE: Record<FatigueState, { label: string; cls: string }> = {
  fresh: { label: "Fresh", cls: "bg-[var(--good-bg)] text-[var(--good-ink)]" },
  watch: { label: "Watch", cls: "bg-[var(--accent-soft)] text-[var(--accent)]" },
  fatiguing: { label: "Fatiguing", cls: "bg-[var(--warn-bg)] text-[var(--warn-ink)]" },
  fatigued: { label: "Fatigued", cls: "bg-[var(--bad-bg)] text-[var(--bad-ink)]" },
};

function halfLifeLabel(days: number | null | undefined): string {
  if (days === null || days === undefined) return "assessing";
  if (days === 0) return "past floor";
  return `~${days}d left`;
}

export function FatigueRadar({ ads, halfLife, accountId, dateParam }: { ads: CockpitAd[]; halfLife?: CreativeHalfLife; accountId?: string; dateParam?: string }) {
  // Worst first: highest fatigue index at the top so the ads to act on lead.
  const rows = [...ads]
    .filter((a) => a.fatigueRead)
    .sort((a, b) => (b.fatigueRead?.index ?? 0) - (a.fatigueRead?.index ?? 0))
    .slice(0, 6);

  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-base font-semibold">Creative half-life &amp; fatigue</div>
        <span className="shrink-0 rounded-[70px] border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">
          Day-wise
        </span>
      </div>

      {/* Account half-life headline */}
      <div className="mb-3 text-[13px] text-[var(--ink-muted)]">
        {halfLife && halfLife.medianDays !== null ? (
          <>
            Account half-life <span className="font-semibold text-[var(--ink)] tabular-nums">~{halfLife.medianDays} days</span> ·{" "}
            {halfLife.fatiguingAds} fatiguing. {halfLife.basis}
          </>
        ) : (
          (halfLife?.basis ?? "State from the day-wise fatigue engine.")
        )}
      </div>

      <div>
        {rows.map((ad) => {
          const f = ad.fatigueRead!;
          const s = STATE_STYLE[f.state];
          return (
            <div key={ad.id} className="border-t border-[var(--surface-alt)] py-3 first:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <AdLink accountId={accountId} adId={ad.id} name={ad.name} className="truncate text-sm font-medium" dateParam={dateParam} />
                  <span className={`shrink-0 rounded-[70px] px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                </div>
                <span className="shrink-0 text-xs font-medium text-[var(--ink-muted)] tabular-nums">
                  {f.sufficiency === "ok" ? halfLifeLabel(ad.halfLifeDays) : "needs history"}
                </span>
              </div>
              <div className="mt-1 truncate text-xs text-[var(--ink-muted)]" title={f.evidence.join(" ")}>
                {f.sufficiency === "ok" ? f.evidence[0] : `Only ${f.windowDays} day${f.windowDays === 1 ? "" : "s"} of delivery so far.`}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="border-t border-[var(--surface-alt)] py-3 text-sm text-[var(--ink-muted)]">No ads assessed yet.</div>
        )}
      </div>
    </div>
  );
}
