// One shared style for the topbar scope-filter triggers (account, campaign, objective,
// dates). Keeping it here means every filter pill is visually identical and the whole
// toolbar is restyled from a single place, instead of four components drifting apart.
export const FILTER_TRIGGER =
  "flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--ink)] transition hover:border-[var(--accent)]";

// The muted "Account" / "Campaign" / ... label that precedes each value. Standard across
// all filters (no stray "·" or ":" separators), so the toolbar reads as one consistent unit.
export const FILTER_LABEL = "text-[var(--ink-muted)]";
