import type { RetentionCurve } from "@/lib/scoring/retention-curve";

// Account-level video retention curve: of everyone who started the video (3s), what share reached each
// milestone. The SHAPE is the read - a cliff between two points is where the edit loses people.
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function RetentionCurveSection({ curve }: { curve: RetentionCurve }) {
  if (!curve.hasData) {
    return (
      <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">Video retention curve</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-muted)]">
          No quartile view data for this window yet. Meta reports 25/50/75/100% completion per ad; this curve fills in
          as video ads sync from here on (rows synced earlier don&apos;t carry the quartiles).
        </p>
      </section>
    );
  }
  // Retention among video STARTERS (share of 3s-views), the classic curve shape. The 3s row is the 100% anchor.
  const base = curve.points[0]?.count ?? 0;
  const rows = curve.points.map((p) => ({ label: p.label, pct: base > 0 ? p.count / base : 0 }));
  // The biggest single drop between adjacent milestones - where the edit is losing people.
  let worstDrop = { from: "", to: "", drop: 0 };
  for (let i = 1; i < rows.length; i++) {
    const drop = rows[i - 1].pct - rows[i].pct;
    if (drop > worstDrop.drop) worstDrop = { from: rows[i - 1].label, to: rows[i].label, drop };
  }

  return (
    <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
      <h2 className="text-[15px] font-semibold text-[var(--ink)]">Video retention curve</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-muted)]">
        Of everyone who started your videos (3s), the share who reached each milestone, across the account this window.
        {worstDrop.drop > 0 && ` Biggest drop-off: ${worstDrop.from} to ${worstDrop.to} (${pct(worstDrop.drop)} lost) - the edit loses people there.`}
      </p>
      <div className="mt-4 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 text-[13px]">
            <span className="w-16 shrink-0 text-[var(--ink-muted)]">{r.label}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--surface-alt)]">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(0, Math.min(100, r.pct * 100))}%` }} />
            </div>
            <span className="w-12 shrink-0 text-right tabular-nums text-[var(--ink)]">{pct(r.pct)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
