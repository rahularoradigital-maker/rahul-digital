import { loadCockpit, parseDays } from "@/lib/app/cockpit-data";
import { ConnectState } from "@/components/app/connect-state";
import type { CockpitAd, CockpitView, Priority } from "@/lib/cockpit/analyze";
import { VERDICT_STYLE, PRIORITY_STYLE } from "@/components/cockpit/styles";
import { AdLink } from "@/components/cockpit/AdLink";
import { JudgmentButtons } from "@/components/app/judgment-buttons";

// Action Center: the full ranked action queue (rulebook 7.1 Scale/Continue/Stop
// gates + 5.6 law "every screen ends in a ranked action with a number"). Renders
// view.doThis grouped by priority, each row joined back to its real CockpitAd for
// the verdict chip, spend and ROAS. Nothing here is fabricated: an empty group is
// simply not shown, and an empty queue gets an honest empty state, not an error.

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

type PlanItem = CockpitView["doThis"][number];

export default async function ActionCenterPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days } = await searchParams;
  const data = await loadCockpit(parseDays(days));

  if (!data.connected) {
    return <ConnectState reason={data.reason} errorNote={data.errorNote} accountName={data.accountName} days={data.days} />;
  }

  return <ActionCenter view={data.view} accountId={data.accountId} dateParam={data.dateParam} />;
}

const SECTIONS: { priority: Priority; heading: string }[] = [
  { priority: "DO_NOW", heading: "Do now" },
  { priority: "DO_NEXT", heading: "Do next" },
  { priority: "WATCH", heading: "Watch" },
];

function ActionCenter({ view, accountId, dateParam }: { view: CockpitView; accountId?: string; dateParam?: string }) {
  const byId = new Map(view.leaderboard.map((a) => [a.id, a]));
  const doNow = view.doThis.filter((a) => a.priority === "DO_NOW");
  const doNowSpendRs = doNow.reduce((acc, a) => acc + (byId.get(a.adId)?.spendRs ?? 0), 0);

  if (view.doThis.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--ink-muted)]">
          No actions to take in this window. Every ad the engine assessed is holding steady.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-5 text-sm">
        <span className="font-semibold text-[var(--ink)]">
          {doNow.length} do-now action{doNow.length === 1 ? "" : "s"}
        </span>
        <span className="text-[var(--ink-muted)]"> sitting on {rupees.format(doNowSpendRs)} of spend.</span>
      </div>

      {SECTIONS.map(({ priority, heading }) => {
        const items = view.doThis.filter((a) => a.priority === priority);
        if (items.length === 0) return null;
        return <ActionSection key={priority} heading={heading} items={items} doThis={view.doThis} byId={byId} accountId={accountId} dateParam={dateParam} />;
      })}

      <p className="text-xs text-[var(--ink-muted)]">Nothing is applied automatically. You make each change in your ad account.</p>
    </div>
  );
}

function Header() {
  return (
    <div>
      <div className="text-[13px] text-[var(--ink-muted)]">Ranked by priority · what to ship first</div>
      <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight">Action Center</h1>
    </div>
  );
}

function ActionSection({
  heading,
  items,
  doThis,
  byId,
  accountId,
  dateParam,
}: {
  heading: string;
  items: PlanItem[];
  doThis: PlanItem[];
  byId: Map<string, CockpitAd>;
  accountId?: string;
  dateParam?: string;
}) {
  const style = PRIORITY_STYLE[items[0].priority];
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
      <div className="mb-2 flex items-center gap-2.5">
        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
        <div className="text-base font-semibold">{heading}</div>
        <span className="rounded-[70px] bg-[var(--surface-alt)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ink-muted)]">
          {items.length}
        </span>
      </div>
      <div>
        {items.map((item) => {
          const rank = doThis.indexOf(item) + 1;
          const ad = byId.get(item.adId);
          return (
            <div
              key={`${item.adId}-${item.label}`}
              className="grid grid-cols-[24px_1fr_auto] items-start gap-3 border-t border-[var(--surface-alt)] py-3.5"
            >
              <span className="pt-0.5 text-[13px] font-semibold text-[var(--ink-muted)] tabular-nums">
                {String(rank).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <AdLink accountId={accountId} adId={item.adId} name={item.adName} className="truncate text-sm font-medium" dateParam={dateParam} />
                  <span className="shrink-0 text-sm text-[var(--ink-muted)]">·</span>
                  <span className="shrink-0 truncate text-sm text-[var(--ink)]">{item.label}</span>
                </div>
                <div className="mt-1 text-[13px] text-[var(--ink-muted)]">{item.why}</div>
                {dateParam && (
                  <div className="mt-2">
                    <JudgmentButtons adId={item.adId} timeWindow={dateParam} />
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {ad && <span className={`rounded-[70px] px-3 py-1 text-xs font-semibold ${VERDICT_STYLE[ad.verdict].cls}`}>{VERDICT_STYLE[ad.verdict].label}</span>}
                <span className="text-xs text-[var(--ink-muted)] tabular-nums">
                  {ad ? rupees.format(ad.spendRs) : "n/a"} · {ad?.roas == null ? "n/a" : `${ad.roas.toFixed(1)}x`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
