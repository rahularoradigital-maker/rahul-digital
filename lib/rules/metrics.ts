// Deterministic ad-performance metrics (ADR: rules engine is the source of truth).
// These are the authoritative numbers an AI later only narrates. They NEVER guess:
// on empty rows or a zero denominator they return the insufficient_data sentinel
// instead of a fabricated or divide-by-zero number.

import type { MetricsRow } from "../ad-source.ts";

/** A computed metric, or an explicit "not enough data" signal. Never a fake number. */
export type MetricResult =
  | { status: "ok"; value: number }
  | { status: "insufficient_data" };

const INSUFFICIENT: MetricResult = { status: "insufficient_data" };

function sum(rows: MetricsRow[], pick: (r: MetricsRow) => number): number {
  return rows.reduce((acc, r) => acc + pick(r), 0);
}

/** Return on ad spend = sum(revenue) / sum(spend). Zero spend or no rows → insufficient. */
export function roas(rows: MetricsRow[]): MetricResult {
  if (rows.length === 0) return INSUFFICIENT;
  const spend = sum(rows, (r) => r.spend);
  if (spend === 0) return INSUFFICIENT; // never divide by zero, never invent a ROAS
  return { status: "ok", value: sum(rows, (r) => r.revenue) / spend };
}

/** Click-through rate = sum(clicks) / sum(impressions). Zero impressions or no rows → insufficient. */
export function ctr(rows: MetricsRow[]): MetricResult {
  if (rows.length === 0) return INSUFFICIENT;
  const impressions = sum(rows, (r) => r.impressions);
  if (impressions === 0) return INSUFFICIENT;
  return { status: "ok", value: sum(rows, (r) => r.clicks) / impressions };
}

/** Cost per acquisition = sum(spend) / sum(purchases). Zero purchases or no rows → insufficient. */
export function cpa(rows: MetricsRow[]): MetricResult {
  if (rows.length === 0) return INSUFFICIENT;
  const purchases = sum(rows, (r) => r.purchases);
  if (purchases === 0) return INSUFFICIENT; // no conversions yet → no honest CPA exists
  return { status: "ok", value: sum(rows, (r) => r.spend) / purchases };
}
