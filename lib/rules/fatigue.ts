// Deterministic creative-fatigue heuristic (rules engine = source of truth).
// Fatigue rises when an ad is shown to the same people repeatedly (high frequency)
// and its click-through rate is decaying. This is a HEURISTIC, not a model: it
// returns a bounded 0-1 score, and refuses to score at all when data is too thin.

import type { MetricsRow } from "../ad-source.ts";
import { ctr } from "./metrics.ts";

export type FatigueResult =
  | { status: "ok"; score: number; pastHalfLife: boolean }
  | { status: "insufficient_data" };

const MIN_ROWS = 7; // need at least a week of daily data to judge a trend
const WINDOW = 3; // compare the first vs last 3 days

// ceiling: this is a linear two-signal blend, not a survival/half-life model.
// frequency is normalised against FREQ_CAP (freq >= 3 is treated as fully saturated),
// and the CTR-decay signal is the relative drop from the first window to the last.
// Upgrade path: fit a real decay curve per ad once we have enough history.
const FREQ_CAP = 3;
const FREQ_WEIGHT = 0.5;
const DECAY_WEIGHT = 0.5;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Score creative fatigue on [0,1]. Requires >= 7 daily rows or → insufficient_data
 * (never guesses on thin data). pastHalfLife = score >= 0.7.
 */
export function fatigue(rows: MetricsRow[]): FatigueResult {
  if (rows.length < MIN_ROWS) return { status: "insufficient_data" };

  // Order by date so "first 3 days" vs "last 3 days" is meaningful regardless of input order.
  const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  // Signal 1: average frequency, normalised. More repeat exposure → more fatigue.
  const avgFreq =
    ordered.reduce((acc, r) => acc + r.frequency, 0) / ordered.length;
  const freqSignal = clamp01(avgFreq / FREQ_CAP);

  // Signal 2: CTR decay. Compare aggregate CTR of the last 3 days to the first 3 days.
  const first = ctr(ordered.slice(0, WINDOW));
  const last = ctr(ordered.slice(-WINDOW));
  let decaySignal = 0;
  if (first.status === "ok" && last.status === "ok" && first.value > 0) {
    // relative drop: 0 if CTR held or rose, up to 1 if it collapsed to zero.
    decaySignal = clamp01((first.value - last.value) / first.value);
  }

  const score = clamp01(FREQ_WEIGHT * freqSignal + DECAY_WEIGHT * decaySignal);
  return { status: "ok", score, pastHalfLife: score >= 0.7 };
}
