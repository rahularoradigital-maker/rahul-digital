import type { CpaDecomposition } from "@/lib/scoring/cpa-decomposition";
import { rupees } from "@/lib/format";

// Renders the CPA = CPM / (CTR x CVR) decomposition for the window vs the equal window before it. Names WHICH
// lever moved cost per acquisition, so a bid change isn't the reflex. Honest hold when a window is too thin.

const DRIVER_LABEL: Record<string, string> = { cpm: "CPM (auction cost)", ctr: "CTR (creative / targeting)", cvr: "CVR (landing / offer)" };

export function CpaDecompositionSection({ d }: { d: CpaDecomposition }) {
  if (!d.ok || !d.contributions) {
    return null; // no honest decomposition for this window - stay silent rather than show an empty card
  }
  const rows = (["cpm", "ctr", "cvr"] as const).map((k) => ({ k, v: d.contributions![k] }));
  const worse = (d.deltaPct ?? 0) >= 0;
  return (
    <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
      <h2 className="text-[15px] font-semibold text-[var(--ink)]">Why CPA moved</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-muted)]">
        CPA = CPM / (CTR x CVR). This window vs the equal window before it, cost per purchase went from{" "}
        {d.cpaBefore !== null ? rupees.format(d.cpaBefore) : "-"} to {d.cpaAfter !== null ? rupees.format(d.cpaAfter) : "-"}{" "}
        (<span className={worse ? "text-[var(--bad-ink)]" : "text-[var(--good-ink)]"}>{worse ? "+" : ""}{d.deltaPct}%</span>). Fix the biggest driver before touching bids.
      </p>
      <div className="mt-4 space-y-2">
        {rows.map(({ k, v }) => {
          const pushedUp = v > 0;
          return (
            <div key={k} className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] py-2 first:border-0 text-[13px]">
              <span className="text-[var(--ink)]">
                {DRIVER_LABEL[k]}
                {k === d.dominant && <span className="ml-2 rounded bg-[var(--surface-alt)] px-1.5 py-0.5 text-[11px] text-[var(--ink-muted)]">biggest driver</span>}
              </span>
              <span className={`tabular-nums ${Math.abs(v) < 0.05 ? "text-[var(--ink-muted)]" : pushedUp ? "text-[var(--bad-ink)]" : "text-[var(--good-ink)]"}`}>
                {pushedUp ? "+" : ""}{v}pp {Math.abs(v) < 0.05 ? "(flat)" : pushedUp ? "(pushed CPA up)" : "(pulled CPA down)"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
