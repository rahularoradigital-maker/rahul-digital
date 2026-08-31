"use client";

import { useEffect, useState } from "react";

// Format diversity / "what to test next" panel for the Creative Studio. Reads /api/creative-production/coverage
// and shows: how many of the 42 best-performing formats this brand has tested, coverage per category, and the
// recommended next formats to try (diversity-first). Self-contained: drop it into the Studio; bump `reloadKey`
// after generating assets to refresh. Theme-aware via the app's CSS tokens.

type Row = { id: string; name: string; category: string; awarenessStage: string; tested: boolean };
type CategoryCoverage = { category: string; tested: number; total: number };
type Coverage = { total: number; testedCount: number; rows: Row[]; byCategory: CategoryCoverage[]; recommended: Row[] };

const CAT_LABEL: Record<string, string> = {
  "ui-mockup": "UI mockup",
  "social-proof": "Social proof",
  comparison: "Comparison",
  "urgency-offer": "Urgency / offer",
  editorial: "Editorial",
  humor: "Humor",
  ugc: "UGC",
  "problem-education": "Problem / education",
};

export function FormatCoveragePanel({ reloadKey = 0 }: { reloadKey?: number }) {
  const [cov, setCov] = useState<Coverage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/creative-production/coverage")
      .then((r) => r.json())
      .then((d: Coverage & { error?: string }) => {
        if (!live) return;
        if (d.error) setErr(d.error);
        else setCov(d);
      })
      .catch(() => live && setErr("Could not load coverage"));
    return () => {
      live = false;
    };
  }, [reloadKey]);

  if (err || !cov) return null; // silent when unavailable - never blocks the flow

  const pct = cov.total ? Math.round((cov.testedCount / cov.total) * 100) : 0;

  return (
    <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <div className="text-[14px] font-semibold text-[var(--ink)]">Format coverage</div>
          <div className="text-[12px] text-[var(--ink-muted)]">Tested {cov.testedCount} of {cov.total} best-performing formats ({pct}%)</div>
        </div>
        <span className="text-[12px] text-[var(--ink-muted)]">{open ? "Hide" : "What to test next"}</span>
      </button>

      {/* progress bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--hairline)]">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
      </div>

      {/* recommended next formats (always shown - the actionable bit) */}
      {cov.recommended.length > 0 && (
        <div className="mt-3">
          <div className="text-[12px] font-medium text-[var(--ink-muted)]">Test next (formats you haven&apos;t tried):</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {cov.recommended.map((r) => (
              <span key={r.id} className="rounded-full border border-[var(--hairline)] px-3 py-1 text-[12px] text-[var(--ink)]">
                {r.name}
                <span className="ml-1.5 text-[var(--ink-muted)]">· {CAT_LABEL[r.category] ?? r.category}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* per-category coverage (expandable) */}
      {open && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {cov.byCategory.map((c) => (
            <div key={c.category} className="flex items-center justify-between gap-2 rounded-[8px] border border-[var(--hairline)] px-3 py-2">
              <span className="text-[12px] text-[var(--ink)]">{CAT_LABEL[c.category] ?? c.category}</span>
              <span className="text-[12px] tabular-nums text-[var(--ink-muted)]">{c.tested}/{c.total}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
