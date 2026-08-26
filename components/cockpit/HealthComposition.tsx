// The component bars next to the health ring. Each row is a REAL share of spend
// (0-1) the caller computed from view.leaderboard + view.totals, so the bars are an
// honest breakdown of where the score comes from, not fabricated sub-scores.
export type CompositionRow = { label: string; share: number; bar: string };

export function HealthComposition({ rows }: { rows: CompositionRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-7 gap-y-3.5 sm:grid-cols-2">
      {rows.map((r) => {
        const pct = Math.round(Math.max(0, Math.min(1, r.share)) * 100);
        return (
          <div key={r.label}>
            <div className="mb-1.5 flex justify-between text-[13px]">
              <span className="text-[var(--ink-muted)]">{r.label}</span>
              <span className="font-semibold tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-[70px] bg-[var(--surface-alt)]">
              <div className={`h-full rounded-[70px] ${r.bar}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
