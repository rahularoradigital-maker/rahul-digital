import type { CreativeStrategy } from "@/lib/creative/strategy";
import { rupees } from "@/lib/format";

// The read a top-0.1% creative strategist makes: what's winning (DNA), how exposed the portfolio is
// (fragility), which proven angle is under-backed (white-space), and what to make next (brief). All from
// real spend + winner data - nothing here is generic advice.

const FRAG = {
  high: { label: "High risk", cls: "bg-[var(--bad-bg)] text-[var(--bad-ink)]" },
  medium: { label: "Medium risk", cls: "bg-[var(--warn-bg)] text-[var(--warn-ink)]" },
  low: { label: "Low risk", cls: "bg-[var(--good-bg)] text-[var(--good-ink)]" },
} as const;

export function CreativeStrategyCard({ s }: { s: CreativeStrategy }) {
  const frag = FRAG[s.fragility.level];
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-base font-normal">Creative strategy</div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${frag.cls}`}>{frag.label}</span>
      </div>
      <p className="mb-5 text-[13px] leading-relaxed text-[var(--ink-muted)]">{s.summary}</p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Winning DNA */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">What's winning (DNA)</div>
          {s.winningDNA.length === 0 ? (
            <div className="text-[13px] text-[var(--ink-muted)]">No single attribute clearly out-wins yet — keep testing angles.</div>
          ) : (
            <ul className="space-y-1.5">
              {s.winningDNA.slice(0, 5).map((d) => (
                <li key={`${d.dimension}-${d.attribute}`} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0 truncate"><span className="font-medium text-[var(--ink)]">{d.attribute}</span> <span className="text-[var(--ink-muted)]">· {d.dimension}</span></span>
                  <span className="shrink-0 tabular-nums text-[var(--good-ink)]">+{d.lift} · {Math.round(d.spendShare * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Proven white-space */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">Proven, under-backed (white-space)</div>
          {s.whitespace.length === 0 ? (
            <div className="text-[13px] text-[var(--ink-muted)]">No proven-but-thin angle right now — your spend already backs what works.</div>
          ) : (
            <ul className="space-y-1.5">
              {s.whitespace.slice(0, 5).map((w) => (
                <li key={`${w.dimension}-${w.bucket}`} className="text-[13px]">
                  <span className="font-medium text-[var(--ink)]">{w.bucket}</span> <span className="text-[var(--ink-muted)]">· {w.dimension} — {w.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Production brief */}
      {s.brief.length > 0 && (
        <div className="mt-5 border-t border-[var(--surface-alt)] pt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">Make next</div>
          <ol className="space-y-2">
            {s.brief.map((b, i) => (
              <li key={i} className="grid grid-cols-[20px_1fr] gap-2 text-[13px]">
                <span className="pt-0.5 font-semibold text-[var(--ink-muted)] tabular-nums">{i + 1}</span>
                <span><span className="font-medium text-[var(--ink)]">{b.make}</span> <span className="text-[var(--ink-muted)]">— {b.because}</span></span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
