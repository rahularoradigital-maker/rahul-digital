// A small "i" that reveals a metric's FORMULA on hover or keyboard focus - so every headline number is
// auditable in place, without opening a drawer (charter: explain the decision). Pure presentation: the
// caller passes the formula string (canonically from lib/cockpit/formulas.ts). Generalised from the
// EventRoiCard info dot so every metric tile shares one styled, theme-aware, accessible affordance.
//
// Hover shows it via CSS group-hover (no JS/state); focus shows it via group-focus-within so keyboard
// and screen-reader users get the same disclosure. The tooltip is aria-hidden decoration; the button's
// aria-label already names what it does.

export function FormulaHint({
  formula,
  label,
  align = "left",
}: {
  formula: string;
  label?: string; // metric name, for the button's accessible label
  align?: "left" | "right"; // which edge the tooltip pins to (avoid overflow near a card edge)
}) {
  if (!formula) return null;
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label ? `How ${label} is calculated` : "How this metric is calculated"}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--hairline)] text-[10px] leading-none text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        i
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-6 z-20 hidden w-72 max-w-[calc(100vw-2rem)] rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] p-3 text-left text-[12px] font-normal normal-case leading-relaxed tracking-normal text-[var(--ink)] shadow-md group-hover:block group-focus-within:block ${align === "right" ? "right-0" : "left-0"}`}
      >
        {formula}
      </span>
    </span>
  );
}
