"use client";

// "Why this score?" - the one place a number opens up to show the rule behind it.
// It reads the same rubric registry the compute path uses (lib/scoring/rubrics), so the
// explanation can never drift from the score. Pure presentation: hand it an Explanation.
import { useEffect, useRef, useState } from "react";
import { rubric, type Explanation } from "@/lib/scoring/rubrics";

const LABEL = "text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]";

export function WhyDrawer({ explanation }: { explanation: Explanation }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const r = rubric(explanation.rubricId);

  // Close on outside click + Escape (only while open, so we don't leak listeners).
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-label="Why this score?"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[9px] leading-none"
        >
          i
        </span>
        Why?
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Score explanation"
          className="absolute right-0 z-50 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-4 text-[13px] text-[var(--ink)] shadow-lg motion-safe:transition-opacity"
        >
          {/* Headline: the one-line plain-English reason. */}
          <div className="mb-3 font-semibold leading-snug">{explanation.headline}</div>

          {/* The rubric itself: the question this score answers + its formula. */}
          {r && (
            <div className="mb-3 space-y-2">
              <div>
                <div className={LABEL}>Question</div>
                <div className="mt-0.5 leading-snug text-[var(--ink-muted)]">{r.question}</div>
              </div>
              <div>
                <div className={LABEL}>Formula</div>
                <div className="mt-0.5 leading-snug text-[var(--ink-muted)]">{r.formula}</div>
              </div>
            </div>
          )}

          {/* How it's computed: inputs -> result, in order. */}
          {explanation.steps.length > 0 && (
            <div className="mb-3">
              <div className={`${LABEL} mb-1`}>How it&apos;s computed</div>
              <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface-alt)] p-2">
                {explanation.steps.map((s, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3 py-0.5">
                    <span className="min-w-0 text-[var(--ink-muted)]">{s.label}</span>
                    <span className="shrink-0 font-medium tabular-nums">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Benchmarks: the anchors that make an absolute score mean something. */}
          {r?.benchmarks && r.benchmarks.length > 0 && (
            <div className="mb-3">
              <div className={`${LABEL} mb-1`}>Benchmarks</div>
              <ul className="space-y-0.5">
                {r.benchmarks.map((b, i) => (
                  <li key={i} className="text-[11px] leading-snug text-[var(--ink-muted)]">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Per-item drivers (e.g. per-ad), when the score is an aggregate. */}
          {explanation.contributions && explanation.contributions.length > 0 && (
            <div>
              <div className={`${LABEL} mb-1`}>Drivers</div>
              <div className="overflow-x-auto rounded-[10px] border border-[var(--hairline)]">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="text-left text-[var(--ink-muted)]">
                      <th className="px-2 py-1 font-semibold">Ad</th>
                      <th className="px-2 py-1 font-semibold">Tag</th>
                      <th className="px-2 py-1 text-right font-semibold">Metric</th>
                      <th className="px-2 py-1 text-right font-semibold">Score</th>
                      <th className="px-2 py-1 text-right font-semibold">Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {explanation.contributions.map((c, i) => (
                      <tr key={i} className="border-t border-[var(--hairline)] align-baseline">
                        <td className="max-w-[110px] truncate px-2 py-1" title={c.name}>
                          {c.name}
                        </td>
                        <td className="px-2 py-1">
                          <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[var(--accent)]">
                            {c.tag}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">{c.metric}</td>
                        <td className="px-2 py-1 text-right font-medium tabular-nums">{c.score}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{Math.round(c.spendShare * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
