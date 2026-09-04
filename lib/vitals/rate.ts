// S6 (scale plan): pure Core-Web-Vitals rating. No I/O, no server-only, so the gate exercises it and the API
// route can reuse it to reject junk before a DB write. Thresholds are Google's published good/poor cutoffs
// (web.dev/vitals) - a value at or below `good` is "good", above `poor` is "poor", between is "needs-improvement".
// Units: milliseconds for LCP/FCP/TTFB/INP, unitless for CLS.

export type VitalName = "LCP" | "FCP" | "TTFB" | "CLS" | "INP";
export type VitalRating = "good" | "needs-improvement" | "poor";

// [goodAtOrBelow, poorAbove]. Between the two is "needs-improvement".
const THRESHOLDS: Record<VitalName, [number, number]> = {
  LCP: [2500, 4000],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
  CLS: [0.1, 0.25],
  INP: [200, 500],
};

export function isVitalName(name: string): name is VitalName {
  return name in THRESHOLDS;
}

// Reject values that can't be real (negative, NaN, or absurdly large) so a malformed/hostile beacon never
// pollutes the p75. Cap: CLS is unitless (small); the timing metrics are ms and a real page is well under 10min.
export function isValidVitalValue(name: VitalName, value: number): boolean {
  if (!Number.isFinite(value) || value < 0) return false;
  return name === "CLS" ? value <= 100 : value <= 600_000;
}

export function rateVital(name: VitalName, value: number): VitalRating {
  const [good, poor] = THRESHOLDS[name];
  if (value <= good) return "good";
  if (value > poor) return "poor";
  return "needs-improvement";
}

// p75 is the field-data standard for reporting vitals (Google reports the 75th percentile). Nearest-rank on a
// copy of the values; empty -> null (never a fabricated 0).
export function p75(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.75 * sorted.length) - 1);
  return sorted[idx];
}
