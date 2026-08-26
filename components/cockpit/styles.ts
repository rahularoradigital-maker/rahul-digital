// Shared presentational maps for the cockpit. Colors come straight from the telli
// verdict/semantic CSS vars in globals.css. No data is invented here: these only
// translate an engine value (verdict / priority) into a chip class.

import type { Verdict, Priority } from "@/lib/cockpit/analyze";

export const VERDICT_STYLE: Record<Verdict, { label: string; cls: string }> = {
  winner: { label: "Scale", cls: "bg-[var(--good-bg)] text-[var(--good-ink)]" },
  refresh: { label: "Iterate", cls: "bg-[var(--warn-bg)] text-[var(--warn-ink)]" },
  do_not_kill_yet: { label: "Hold", cls: "bg-[var(--accent-soft)] text-[var(--accent)]" },
  loser: { label: "Kill", cls: "bg-[var(--bad-bg)] text-[var(--bad-ink)]" },
};

export const PRIORITY_STYLE: Record<Priority, { label: string; cls: string; dot: string }> = {
  DO_NOW: { label: "Do now", cls: "bg-[var(--bad-bg)] text-[var(--bad-ink)]", dot: "bg-[var(--bad-ink)]" },
  DO_NEXT: { label: "Do next", cls: "bg-[var(--warn-bg)] text-[var(--warn-ink)]", dot: "bg-[var(--warn-ink)]" },
  WATCH: { label: "Watch", cls: "bg-[var(--surface-alt)] text-[var(--ink-muted)]", dot: "bg-[var(--ink-muted)]" },
};

// A fatigue state read off the verdict the engine already produced. "refresh" means
// fatigue is high but the funnel still converts (see actionFor in analyze.ts); "loser"
// means the creative is spent. This is an honest re-label of a real verdict, not a
// fabricated fatigue score, so no 7/14-day probability is invented.
export const FATIGUE_STATE: Record<Verdict, { label: string; cls: string; bar: string }> = {
  winner: { label: "Healthy", cls: "bg-[var(--good-bg)] text-[var(--good-ink)]", bar: "bg-[var(--good-ink)]" },
  refresh: { label: "Fatiguing", cls: "bg-[var(--warn-bg)] text-[var(--warn-ink)]", bar: "bg-[var(--warn-ink)]" },
  do_not_kill_yet: { label: "Watch", cls: "bg-[var(--accent-soft)] text-[var(--accent)]", bar: "bg-[var(--accent)]" },
  loser: { label: "Fatigued", cls: "bg-[var(--bad-bg)] text-[var(--bad-ink)]", bar: "bg-[var(--bad-ink)]" },
};
