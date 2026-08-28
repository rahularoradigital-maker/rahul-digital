import { ConnectState } from "@/components/app/connect-state";
import type { CockpitData } from "@/lib/app/cockpit-data";
import { AdLink } from "@/components/cockpit/AdLink";

// Budget & Scaling tab of the consolidated Media page. Logic reused verbatim from
// the former app/app/budget-scaling/page.tsx: rulebook 5 (spend on the margin, not
// the average) and 7.1 (scale by 30% at a time, never doubled overnight). Real
// connected-account data only, straight from data.view; no sample numbers.

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function BudgetSection({ data, days }: { data: CockpitData; days: number }) {
  if (!data.connected) {
    return <ConnectState reason={data.reason} errorNote={data.errorNote} accountName={data.accountName} days={days} />;
  }

  const view = data.view;
  const accountName = data.accountName;
  const accountId = data.accountId;
  const dateParam = data.dateParam;
  const conc = view.concentration;
  const waste = view.waste;
  const winners = view.leaderboard.filter((a) => a.verdict === "winner");
  const totalSpendRs = view.totals.spendRs;
  const accountRoas = view.totals.roas; // blended account ROAS, the baseline for "ROI vs account"
  const topBySpend = [...view.leaderboard].filter((a) => a.spendRs > 0).sort((a, b) => b.spendRs - a.spendRs).slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[13px] text-[var(--ink-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--good-ink)]" />
          {`Live · ${accountName} · last ${days} days`}
        </div>
        <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight">Protect the account, spend on the margin.</h1>
      </div>

      {/* Concentration + Waste */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
          <div className="mb-1 text-base font-semibold">Budget concentration</div>
          <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
            Share of spend riding on a single ad. Internal calculation over your account.
          </div>
          {conc.status === "ok" ? (
            <>
              <div className="text-[30px] font-semibold tracking-tight tabular-nums leading-none">
                {Math.round(conc.top1Share * 100)}%
              </div>
              <div className="mt-1.5 text-[13px] text-[var(--ink-muted)]">of spend on your single top ad</div>
              {conc.top1Share > 0.4 && (
                <div className="mt-3 rounded-lg bg-[var(--bg)] px-3 py-2 text-xs text-[var(--warn-ink)]">
                  High concentration. Protect the account like capital, spread spend before it rides on one creative.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-[15px] font-medium text-[var(--ink-muted)]">insufficient_data</div>
              <div className="mt-1 text-xs text-[var(--ink-muted)]">Not enough spend to assess concentration.</div>
            </>
          )}
        </div>

        {waste.status === "ok" && (
          <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
            <div className="mb-1 text-base font-semibold">Budget waste</div>
            <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
              High spend plus poor economics. Small-spend low-ROAS ads are excluded. Insufficient data is not waste.
            </div>
            <div className="flex items-end justify-between gap-4 border-t border-[var(--surface-alt)] pt-4">
              <div>
                <div className="text-[30px] font-semibold tracking-tight tabular-nums leading-none text-[var(--bad-ink)]">
                  {rupees.format(waste.totalWastedRs)}
                </div>
                <div className="mt-1.5 text-[13px] text-[var(--ink-muted)]">
                  {Math.round(waste.shareOfSpend * 100)}% of spend. Clearing the Do-now list is where this comes back.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scaling candidates */}
      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
        <div className="mb-1 text-base font-semibold">Scaling candidates</div>
        <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
          Ads that clear the winner gate this window. Scale by 30% at a time, not more, to avoid a learning reset.
        </div>
        {winners.length === 0 ? (
          <div className="text-[13px] text-[var(--ink-muted)]">No ads clear the winner gate for scaling in this window.</div>
        ) : (
          <div className="divide-y divide-[var(--surface-alt)]">
            {winners.map((ad) => (
              <div key={ad.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <AdLink accountId={accountId} adId={ad.id} name={ad.name} className="block truncate text-[15px] font-semibold" dateParam={dateParam} />
                  <div className="mt-1 text-xs text-[var(--good-ink)]">Scale by 30% at a time, not more.</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[15px] font-semibold tabular-nums">{rupees.format(ad.spendRs)}</span>
                  <span className="text-xs text-[var(--ink-muted)] tabular-nums">
                    {ad.roas === null ? "n/a" : `${ad.roas.toFixed(2)}x ROAS`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spend distribution + Marginal ROAS honest gate */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-base font-semibold">Spend distribution</span>
            <span
              title="Spend share = this ad's spend divided by total account spend this window. Conversions = purchases in the window. ROI vs account = this ad's ROAS compared to the account's blended ROAS - a positive % means the ad returns more per rupee than the account average, negative means less. All from real connected-account data."
              className="cursor-help text-[13px] text-[var(--ink-muted)]"
            >
              &#9432;
            </span>
          </div>
          <div className="mb-4 text-[13px] text-[var(--ink-muted)]">Top ads by share of total spend, with conversions and ROI vs the account.</div>
          {totalSpendRs > 0 && topBySpend.length > 0 ? (
            <div className="space-y-3.5">
              {topBySpend.map((ad) => {
                const share = ad.spendRs / totalSpendRs;
                // ROI vs account: the ad's ROAS relative to the account's blended ROAS. Null when
                // the account ROAS cannot be formed (no revenue), so we never show a fake number.
                const roiVsAcct = ad.roas !== null && accountRoas !== null && accountRoas > 0 ? ad.roas / accountRoas - 1 : null;
                return (
                  <div key={ad.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
                      <AdLink accountId={accountId} adId={ad.id} name={ad.name} className="truncate font-medium" dateParam={dateParam} />
                      <span className="shrink-0 tabular-nums text-[var(--ink-muted)]">
                        {rupees.format(ad.spendRs)} · {Math.round(share * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-alt)]">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(share * 100, 2)}%` }} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums text-[var(--ink-muted)]">
                      <span>{ad.conversions} conv</span>
                      <span aria-hidden>·</span>
                      <span>{ad.roas === null ? "n/a ROAS" : `${ad.roas.toFixed(2)}x ROAS`}</span>
                      {roiVsAcct !== null && (
                        <>
                          <span aria-hidden>·</span>
                          <span className={roiVsAcct >= 0 ? "text-[var(--good-ink)]" : "text-[var(--bad-ink)]"}>
                            {roiVsAcct >= 0 ? "+" : ""}
                            {Math.round(roiVsAcct * 100)}% vs account ROI
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[13px] text-[var(--ink-muted)]">No spend recorded in this window.</div>
          )}
        </div>

        <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
          <div className="mb-2 text-[13px] text-[var(--ink-muted)]">Marginal ROAS - needs spend-response history</div>
          <div className="text-[15px] font-medium text-[var(--ink-muted)]">insufficient_data</div>
          <div className="mt-1 text-xs text-[var(--ink-muted)]">
            The next-rupee return on scaling an ad needs spend-response history or a lift test we do not have yet. We never show an
            estimated marginal number.
          </div>
        </div>
      </div>
    </div>
  );
}
