import Link from "next/link";

// One shared "onward action" card for the read-only diagnostic screens (Funnel, Change Impact, Reconcile,
// Media). IA (Phase-0 audit): those screens diagnosed but dead-ended, breaking the product's own rule #1
// ("every screen ends in an action") and the Peak-End rule (leave the user with a clear next step). This is a
// real, focusable Link (>=44px target) so keyboard + touch users get the same onward path. Law of Similarity:
// every diagnostic screen ends the same way.
export function NextStep({ href, label, hint }: { href: string; label: string; hint?: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] px-5 py-4 transition hover:border-[var(--accent)]"
    >
      <div>
        <div className="text-[14px] font-medium text-[var(--ink)]">{label}</div>
        {hint ? <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">{hint}</div> : null}
      </div>
      <span className="shrink-0 text-[18px] text-[var(--ink-muted)] transition group-hover:text-[var(--accent)]" aria-hidden>
        &rarr;
      </span>
    </Link>
  );
}
