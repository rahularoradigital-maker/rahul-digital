"use client";

// "How sure + how computed" disclosure for a headline pillar (measurement canon doctrine:
// "a weight or number must be defended, not decorated"). It pairs the evidence tag with a
// four-part disclosure - what we FETCH, the FORMULA, the LOGIC, and a worked EXAMPLE on
// this account's real numbers - so a reader can see the source and the maths behind a
// pillar, not just the number.
//
// Pure presentation: the caller passes the four strings. The Example must be built from
// real props upstream (never invented); when a number is not available the caller says so.
//
// EXTENSION POINT: to make the funnel / diversity / scaling pillars confidence-inspectable,
// render <MetricDrawer> in their header with a tier + these four strings. Nothing else here
// changes - this component already carries every tier via EvidenceTag.
import { useEffect, useRef, useState } from "react";
import { EvidenceTag } from "./EvidenceTag";
import { EVIDENCE_MEANING, type EvidenceTier } from "@/lib/scoring/evidence";

export type MetricDisclosure = {
  fetch: string; // which API / source the inputs come from
  formula: string; // the real formula
  logic: string; // why it is built this way (1-2 lines)
  example: string; // worked on THIS account's real numbers, or an honest "not available"
};

const LABEL = "text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]";

export function MetricDrawer({
  title,
  tier,
  disclosure,
}: {
  title: string;
  tier: EvidenceTier;
  disclosure: MetricDisclosure;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const e = EVIDENCE_MEANING[tier];

  // Close on outside click + Escape (mirrors WhyDrawer; listeners only while open).
  useEffect(() => {
    if (!open) return;
    function onDown(ev: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const parts: { label: string; value: string }[] = [
    { label: "Fetch", value: disclosure.fetch },
    { label: "Formula", value: disclosure.formula },
    { label: "Logic", value: disclosure.logic },
    { label: "Example", value: disclosure.example },
  ];

  return (
    <span ref={rootRef} className="relative inline-flex items-center gap-1.5">
      {/* (a) the always-visible evidence tag */}
      <EvidenceTag tier={tier} />
      {/* (b) the disclosure trigger */}
      <button
        type="button"
        aria-label={`How ${title} is measured and how sure we are`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[11px] leading-none"
        >
          i
        </span>
        How sure?
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`${title}: how it is measured`}
          className="absolute right-0 top-full z-50 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-4 text-[13px] text-[var(--ink)] shadow-lg motion-safe:transition-opacity"
        >
          <div className="mb-3 font-medium">{title}</div>

          {/* Provenance line: says plainly whether this is a platform fact or our judgement. */}
          <div className="mb-3 flex items-start gap-2 rounded-[8px] bg-[var(--surface-alt)] p-2.5">
            <EvidenceTag tier={tier} />
            <span className="text-[11px] leading-snug text-[var(--ink-muted)]">
              <span className="font-semibold text-[var(--ink)]">{e.name}.</span> {e.meaning}
            </span>
          </div>

          {/* The four honest parts. */}
          <div className="space-y-2.5">
            {parts.map((p) => (
              <div key={p.label}>
                <div className={LABEL}>{p.label}</div>
                <div className="mt-0.5 whitespace-pre-line leading-snug text-[var(--ink-muted)]">{p.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}
