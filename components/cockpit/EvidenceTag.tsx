"use client";

// A / B / C / Y evidence chip (measurement canon doctrine: "every number carries an evidence tag").
// Reads the shared EVIDENCE_MEANING registry so the chip and its check can never drift.
// The meaning reaches screen readers via aria-label and appears on hover / focus for
// sighted keyboard users, so the tag is inspectable, not just a coloured letter.
import { useState } from "react";
import { EVIDENCE_MEANING, evidenceAria, type EvidenceTier } from "@/lib/scoring/evidence";

// Tier -> tone, reusing the existing semantic tokens: platform-fact reads positive,
// panel reads caution, folklore reads danger, our-own-judgement reads accent-neutral.
const TIER_STYLE: Record<EvidenceTier, string> = {
  A: "bg-[var(--good-bg)] text-[var(--good-ink)]",
  B: "bg-[var(--warn-bg)] text-[var(--warn-ink)]",
  C: "bg-[var(--bad-bg)] text-[var(--bad-ink)]",
  Y: "bg-[var(--accent-soft)] text-[var(--accent)]",
};

export function EvidenceTag({ tier }: { tier: EvidenceTier }) {
  const [show, setShow] = useState(false);
  const e = EVIDENCE_MEANING[tier];
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label={evidenceAria(tier)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] px-1 text-[11px] font-bold leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 ${TIER_STYLE[tier]}`}
      >
        {tier}
      </button>
      {show && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-1.5 w-[220px] -translate-x-1/2 rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-[11px] leading-snug text-[var(--ink-muted)] shadow-lg"
        >
          <span className="font-semibold text-[var(--ink)]">
            Evidence {tier} · {e.name}
          </span>
          <span className="mt-0.5 block">{e.meaning}</span>
        </span>
      )}
    </span>
  );
}
