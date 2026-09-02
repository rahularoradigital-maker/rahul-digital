import type { CockpitAd } from "@/lib/cockpit/analyze";
import { AdLink } from "@/components/cockpit/AdLink";
import { RecentVsBaselineBadge } from "@/components/cockpit/RecentVsBaselineBadge";

// "What's working" - the positive counterpart to the fatigue card. Surfaces the ads whose RECENT 7 days are
// beating their own last-30-days average (the Ads Manager cross-check), and confirmed winners that aren't
// slipping. Honest: if nothing is clearly beating its 30-day baseline, it says so rather than inventing a win.

const MAX = 6;

function roasText(a: CockpitAd): string {
  if (a.objective === "conversion") return a.roas == null ? "no ROAS yet" : `ROAS ${a.roas.toFixed(2)}x`;
  return ""; // non-conversion objectives lead with the 7d-vs-30d read below
}

export function WhatsWorking({ ads, accountId, dateParam }: { ads: CockpitAd[]; accountId?: string; dateParam?: string }) {
  const live = ads.filter((a) => a.active !== false && a.delivering !== false && a.spendRs > 0);
  const improving = live.filter((a) => a.recentVs30?.direction === "improving");
  const winnersHolding = live.filter(
    (a) => a.winner && a.winner.overall >= 60 && a.recentVs30?.direction !== "worsening" && !improving.includes(a),
  );
  // Improving first (biggest recent gain), then holding winners (by winner score).
  const working = [
    ...improving.sort((x, y) => (y.recentVs30?.deltaPct ?? 0) - (x.recentVs30?.deltaPct ?? 0)),
    ...winnersHolding.sort((x, y) => (y.winner?.overall ?? 0) - (x.winner?.overall ?? 0)),
  ].slice(0, MAX);

  return (
    <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-medium text-[var(--ink)]">What&apos;s working</h2>
        <span className="rounded-full bg-[#0a7f5b]/10 px-2.5 py-0.5 text-[12px] font-medium text-[#0a7f5b]">{working.length} up vs 30d</span>
      </div>
      <p className="mt-1 text-[13px] text-[var(--ink-muted)]">Ads whose recent 7 days are beating their own last-30-day average, plus winners holding steady.</p>

      {working.length === 0 ? (
        <div className="mt-4 rounded-[10px] border border-dashed border-[var(--hairline)] p-4 text-[13px] text-[var(--ink-muted)]">
          No ad is clearly beating its 30-day average right now. When a recent week pulls ahead, it shows up here.
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--hairline)]">
          {working.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
              <div className="min-w-0 flex-1">
                <AdLink accountId={accountId} adId={a.id} adSetId={a.adSetId} campaignId={a.campaignId} name={a.name} dateParam={dateParam} />
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <RecentVsBaselineBadge r={a.recentVs30} />
                  {roasText(a) ? <span className="text-[12px] text-[var(--ink-muted)]">{roasText(a)}</span> : null}
                  {a.winner && a.winner.overall >= 60 ? <span className="text-[12px] text-[#0a7f5b]">winner</span> : null}
                </div>
              </div>
              <span className="shrink-0 text-[12px] tabular-nums text-[var(--ink-muted)]">₹{a.spendRs.toLocaleString("en-IN")} spent</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
