import type { ReconReport } from "@/lib/reconcile/scopes";

// Presentational (server component) for reconcile-with-Meta. One row per scope, broadest first, so the drop
// from whole-account to a filtered Meta-style view (and the ROAS it hides) reads at a glance.

function money(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function roas(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(2)}x`;
}

export function ReconcileView({ report, accountName, since, until }: { report: ReconReport; accountName: string; since: string; until: string }) {
  const whole = report.scopes.find((s) => s.key === "whole");
  const meta = report.scopes.find((s) => s.key === "active_results");
  const spendHidden = whole && meta ? whole.spend - meta.spend : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <div className="text-[12px] uppercase tracking-wide text-[var(--ink-muted)]">{accountName} · {since} to {until}</div>
        <p className="mt-1 text-[15px] text-[var(--ink)]">
          AdBrain reports the <span className="font-semibold">whole account</span>. A filtered Meta view (active delivery + results) usually
          hides <span className="font-semibold">{money(spendHidden)}</span> of spend, which is why its ROAS reads higher. Same data, different scope.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)]">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[var(--ink-muted)]">
              <th className="px-4 py-3 font-medium">Scope</th>
              <th className="px-4 py-3 font-medium tabular-nums">Ads</th>
              <th className="px-4 py-3 font-medium tabular-nums">Spend</th>
              <th className="px-4 py-3 font-medium tabular-nums">Revenue</th>
              <th className="px-4 py-3 font-medium tabular-nums">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {report.scopes.map((s) => (
              <tr key={s.key} className={`border-t border-[var(--hairline)] ${s.key === "whole" ? "font-semibold" : ""} ${s.key === "active_results" ? "bg-[var(--surface-alt)]" : ""}`}>
                <td className="px-4 py-3">
                  <div className="text-[var(--ink)]">{s.label}{s.key === "active_results" ? <span className="ml-2 rounded bg-[#e8f0fe] px-1.5 py-0.5 text-[10px] font-medium text-[#1a56db]">Meta-like</span> : null}</div>
                  <div className="mt-0.5 text-[11px] font-normal text-[var(--ink-muted)]">{s.description}</div>
                </td>
                <td className="px-4 py-3 tabular-nums text-[var(--ink)]">{s.ads}</td>
                <td className="px-4 py-3 tabular-nums text-[var(--ink)]">{money(s.spend)}</td>
                <td className="px-4 py-3 tabular-nums text-[var(--ink)]">{money(s.revenue)}</td>
                <td className="px-4 py-3 tabular-nums font-medium text-[var(--ink)]">{roas(s.roas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] text-[var(--ink-muted)]">
        AdBrain now pulls conversions using <span className="text-[var(--ink)]">your account&apos;s own attribution setting</span> (the same one Ads
        Manager shows), so revenue and ROAS line up once the date range and filters match. Any remaining gap is scope: whole account vs a
        filtered Meta view (rows above).
      </p>
    </div>
  );
}
