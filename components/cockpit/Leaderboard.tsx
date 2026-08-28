// Creative leaderboard, styled as the telli ranked "test plan" list. Every row is a
// real CockpitAd: verdict chip, confidence bar, spend and ROAS come from the engine.
import type { CockpitAd, Verdict } from "@/lib/cockpit/analyze";
import { VERDICT_STYLE } from "./styles";
import { AdLink } from "./AdLink";

function confColor(v: Verdict): string {
  return v === "winner"
    ? "bg-[var(--good-ink)]"
    : v === "loser"
      ? "bg-[var(--bad-ink)]"
      : "bg-[var(--warn-ink)]";
}

export function Leaderboard({ ads, rupees, accountId, dateParam }: { ads: CockpitAd[]; rupees: Intl.NumberFormat; accountId?: string; dateParam?: string }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)]">
      <div className="flex items-center justify-between px-[22px] pt-5">
        <div>
          <div className="text-base font-semibold">Creative leaderboard</div>
          <div className="text-[13px] text-[var(--ink-muted)]">Ranked by creative score · best first</div>
        </div>
      </div>
      <div className="overflow-x-auto px-[22px] pb-2 pt-2">
        {ads.map((ad, i) => {
          const v = VERDICT_STYLE[ad.verdict];
          const conf = Math.round(ad.confidence * 100);
          return (
            <div
              key={ad.id}
              className="grid min-w-[340px] grid-cols-[26px_1fr_150px_92px] items-center gap-4 border-t border-[var(--surface-alt)] py-4"
            >
              <span className="text-[13px] font-semibold text-[var(--ink-muted)] tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <AdLink accountId={accountId} adId={ad.id} adSetId={ad.adSetId} campaignId={ad.campaignId} name={ad.name} className="truncate text-[15px] font-semibold" dateParam={dateParam} />
                  <span className="shrink-0 rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">
                    {ad.objective}
                  </span>
                </div>
                {ad.why[0] && <div className="mt-1.5 truncate text-[13px] text-[var(--ink-muted)]">&#8627; {ad.why[0]}</div>}
              </div>
              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-alt)]">
                  <div className={`h-full rounded-full ${confColor(ad.verdict)}`} style={{ width: `${conf}%` }} />
                </div>
                <div className="mt-1.5 text-xs text-[var(--ink-muted)] tabular-nums">
                  {conf}% conf · {rupees.format(ad.spendRs)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${v.cls}`}>{v.label}</span>
                <span className="text-xs text-[var(--ink-muted)] tabular-nums">
                  {ad.roas === null ? "n/a" : `${ad.roas.toFixed(1)}x`}
                </span>
                {ad.winner && (
                  <span
                    className="text-[11px] text-[var(--ink-muted)] tabular-nums"
                    title={`Winner score (quality x proven scale x stability x upside): ${ad.winner.why.join(" · ")}`}
                  >
                    win {Math.round(ad.winner.overall)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
