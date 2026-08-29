// Real day-wise creative fatigue, the way a senior media buyer reads it: not a single
// average-frequency proxy, but a TRAJECTORY over the connected window (7 / 14 / 30 days).
// Fatigue is the combination of three day-over-day signals on the ad's OWN daily rows:
//   - frequency climbing   (the same users seeing it again and again -> saturation)
//   - CTR decaying         (the creative stops earning the click -> wear)
//   - CPM rising           (falling relevance -> auction punishes it)
// Every output carries the real day-wise evidence behind it, and nothing is emitted when
// there are too few days to read a trend (insufficient_data, never a fabricated number).
//
// Pure, no I/O. calibrate-at-build constants are marked. One runnable check accompanies it.

import type { MetricsRow } from "../ad-source.ts";
import type { Objective } from "../rules/comparator.ts";
import { settledRows } from "./attribution.ts";

export type FatigueState = "fresh" | "watch" | "fatiguing" | "fatigued";
export type Trajectory = "improving" | "stable" | "worsening";

export type FatigueRead = {
  sufficiency: "ok" | "insufficient_data";
  windowDays: number; // distinct days with delivery in the window
  index: number; // 0-100 fatigue (higher = more fatigued)
  state: FatigueState;
  trajectory: Trajectory;
  signals: { frequency: number; ctrDecay: number; cpmRise: number }; // 0-100 each
  daysToFatigue: number | null; // extrapolated from the CTR decline; null when not declining / unknown
  evidence: string[]; // human-readable day-wise facts (the "why")
};

// calibrate-at-build.
const MIN_DAYS = 4; // fewer than this cannot support a trend read
const WEIGHTS = { frequency: 0.4, ctrDecay: 0.4, cpmRise: 0.2 } as const;
const STATE_CUTS = { fresh: 30, watch: 55, fatiguing: 75 } as const; // <30 fresh, <55 watch, <75 fatiguing, else fatigued
const REL_SLOPE_GAIN = 1400; // maps a per-day relative CTR/CPM change into 0-100 (a ~7%/day move ~= 100)
const CTR_FLOOR_FRACTION = 0.6; // "fatigued" when CTR falls to 60% of the window's starting CTR

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Least-squares slope of y against day index 0..n-1. Returns 0 when it cannot be formed.
function slope(ys: number[]): number {
  const n = ys.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (ys[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function mean(ys: number[]): number {
  return ys.length ? ys.reduce((s, y) => s + y, 0) / ys.length : 0;
}

// The frequency saturation curve (fatigue library [07]): 100*(1-(f+1)^-0.4). Absolute, so
// it anchors the frequency signal even before a slope is visible.
function saturation(freq: number): number {
  return Math.round(100 * (1 - Math.pow(Math.max(0, freq) + 1, -0.4)));
}

/**
 * Read fatigue for one ad from its daily rows. `windowDays` is informational (the lookback
 * the user selected); the read itself uses the days actually present. `opts.endsInDays` is the
 * days until the ad's AD SET / CAMPAIGN end date, if any - a creative cannot outlive its ad
 * set, so the half-life (days-to-fatigue) is capped at that, whichever comes first.
 */
export function readFatigue(rows: MetricsRow[], opts: { endsInDays?: number | null; objective?: Objective } = {}): FatigueRead {
  // One row per day (sum same-day duplicates), oldest first, only days that actually delivered.
  const byDate = new Map<string, { spend: number; impressions: number; clicks: number; revenue: number; freqSum: number; freqN: number }>();
  for (const r of rows) {
    if (r.impressions <= 0) continue;
    const d = byDate.get(r.date) ?? { spend: 0, impressions: 0, clicks: 0, revenue: 0, freqSum: 0, freqN: 0 };
    d.spend += r.spend;
    d.impressions += r.impressions;
    d.clicks += r.clicks;
    d.revenue += r.revenue;
    d.freqSum += r.frequency;
    d.freqN += 1;
    byDate.set(r.date, d);
  }
  const days = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }));
  const windowDays = days.length;

  if (windowDays < MIN_DAYS) {
    // Even without a trend, a scheduled end date IS a hard half-life ceiling worth reporting.
    const endDays = opts.endsInDays ?? null;
    const evidence = [`Only ${windowDays} day${windowDays === 1 ? "" : "s"} of delivery: too few to read a fatigue trend.`];
    if (endDays !== null && endDays >= 0) evidence.push(`Ad set / campaign ends in ~${endDays} days.`);
    return {
      sufficiency: "insufficient_data",
      windowDays,
      index: 0,
      state: "fresh",
      trajectory: "stable",
      signals: { frequency: 0, ctrDecay: 0, cpmRise: 0 },
      daysToFatigue: endDays !== null && endDays >= 0 ? endDays : null,
      evidence,
    };
  }

  const cpm = days.map((d) => (d.spend / d.impressions) * 1000);
  const freq = days.map((d) => (d.freqN ? d.freqSum / d.freqN : 0));

  // OBJECTIVE-AWARE primary metric: the thing this objective is actually optimised for, whose
  // DECLINE is the real fatigue signal. Conversion decays on ROAS (a rising CPA is a falling
  // ROAS); awareness on reach-per-rupee; the click objectives on CTR. Fall back to CTR when the
  // objective metric cannot be formed (e.g. a conversion ad with no tracked revenue).
  const objective = opts.objective ?? "conversion";
  function primaryOf(d: (typeof days)[number]): number {
    if (objective === "conversion") return d.spend > 0 ? d.revenue / d.spend : 0; // ROAS
    if (objective === "awareness") return d.spend > 0 ? d.impressions / d.spend : 0; // reach / rupee
    return d.impressions > 0 ? d.clicks / d.impressions : 0; // CTR
  }
  // The PRIMARY-metric direction must ignore the still-attributing tail: conversion revenue lands days
  // after the click, so the last day(s) always under-report ROAS and every conversion ad would read as
  // decaying at the window edge (false fatigue -> bogus pause/refresh recs + inflated "at-risk" spend).
  // Frequency + CPM settle same-day, so those stay on the full window (latest frequency must be
  // real-time saturation). settledRows leaves the window untouched when it is too short to trim.
  const dirDays = settledRows(days);
  let primary = dirDays.map(primaryOf);
  let metricLabel = objective === "conversion" ? "ROAS" : objective === "awareness" ? "reach/rupee" : "CTR";
  if (mean(primary) === 0) {
    primary = dirDays.map((d) => (d.impressions > 0 ? d.clicks / d.impressions : 0));
    metricLabel = "CTR";
  }

  const cpmMean = mean(cpm);
  const cpmSlope = slope(cpm);
  const latestFreq = freq[freq.length - 1];
  const primaryMean = mean(primary);
  const primarySlope = slope(primary);

  // A trend on a metric that is essentially ZERO is noise: tiny numbers divided by tiny numbers give wild
  // percentages (e.g. "ROAS 0.00 -> 0.00 at -19%/day" on an ad that never really converted). Below a
  // per-metric floor the primary metric cannot support a trend read, so we do NOT let it drive fatigue or
  // claim a %/day - the ad is judged on frequency + CPM and the evidence says so plainly.
  const PRIMARY_FLOOR = metricLabel === "ROAS" ? 0.1 : metricLabel === "CTR" ? 0.001 : 0;
  const primaryMeaningful = primaryMean >= PRIMARY_FLOOR;

  // Relative per-day slopes (dimensionless): a declining primary metric and a rising CPM add fatigue.
  const primaryRelSlope = primaryMeaningful && primaryMean > 0 ? primarySlope / primaryMean : 0; // negative = decaying
  const cpmRelSlope = cpmMean > 0 ? cpmSlope / cpmMean : 0; // positive = rising

  const frequencySignal = saturation(latestFreq);
  const decaySignal = primaryMeaningful ? clamp(-primaryRelSlope * REL_SLOPE_GAIN, 0, 100) : 0;
  const cpmRiseSignal = clamp(cpmRelSlope * REL_SLOPE_GAIN, 0, 100);

  const index = clamp(
    Math.round(WEIGHTS.frequency * frequencySignal + WEIGHTS.ctrDecay * decaySignal + WEIGHTS.cpmRise * cpmRiseSignal),
    0,
    100,
  );

  const state: FatigueState =
    index < STATE_CUTS.fresh ? "fresh" : index < STATE_CUTS.watch ? "watch" : index < STATE_CUTS.fatiguing ? "fatiguing" : "fatigued";

  const trajectory: Trajectory =
    primaryRelSlope < -0.01 || cpmRelSlope > 0.02 ? "worsening" : primaryRelSlope > 0.01 && cpmRelSlope < 0 ? "improving" : "stable";

  // Days-to-fatigue: extrapolate the primary metric's decline to a floor of 60% of its start.
  // Only meaningful when it is actually declining and above the floor.
  let daysToFatigue: number | null = null;
  const startPrimary = primary[0];
  const latestPrimary = primary[primary.length - 1];
  if (primaryMeaningful && primarySlope < 0 && startPrimary > 0) {
    const floor = startPrimary * CTR_FLOOR_FRACTION;
    if (latestPrimary > floor) {
      daysToFatigue = Math.max(1, Math.round((latestPrimary - floor) / -primarySlope));
    } else {
      daysToFatigue = 0; // already at/below the fatigue floor
    }
  }

  // The creative cannot outlive its ad set / campaign: cap the half-life at the days until the
  // scheduled end date. If the CTR is not declining (no fatigue date) but the ad set ends soon,
  // the end date IS the effective half-life.
  const endsInDays = opts.endsInDays ?? null;
  const cappedByEnd = endsInDays !== null && endsInDays >= 0 && (daysToFatigue === null || endsInDays < daysToFatigue);
  if (cappedByEnd) daysToFatigue = endsInDays;

  // Format the primary metric for the evidence: CTR as a percentage, ROAS / reach as a ratio.
  const fmtPrimary = (v: number) => (metricLabel === "CTR" ? `${(v * 100).toFixed(2)}%` : v.toFixed(2));
  const nearZero = (v: number) => v < (metricLabel === "CTR" ? 0.0005 : 0.005); // rounds to 0.00 in the display
  // The primary-metric line, written to make sense in every case (no more "0.00 -> 0.00 at -19%/day"):
  //  - metric near zero throughout: say the trend can't be read, name what we judge on instead
  //  - collapsed from a real value to ~0: say "fell to near zero" (not "-> 0.00")
  //  - otherwise: the normal start -> end (+/-%/day)
  const primaryLine = !primaryMeaningful
    ? `${metricLabel} stayed near zero over ${primary.length} days - too little conversion to read a trend, so this ad is judged on frequency and CPM, not ${metricLabel}.`
    : nearZero(latestPrimary)
      ? `${metricLabel} fell from ${fmtPrimary(startPrimary)} to near zero over ${primary.length} days (${(primaryRelSlope * 100).toFixed(1)}%/day) - a real collapse.`
      : `${metricLabel} ${fmtPrimary(startPrimary)} -> ${fmtPrimary(latestPrimary)} over ${primary.length} settled days (${primaryRelSlope >= 0 ? "+" : ""}${(primaryRelSlope * 100).toFixed(1)}%/day).`;
  const evidence: string[] = [
    primaryLine,
    `Frequency now ${latestFreq.toFixed(1)} (saturation ${frequencySignal}/100).`,
    `CPM ${cpm[0].toFixed(0)} -> ${cpm[cpm.length - 1].toFixed(0)} (${cpmRelSlope >= 0 ? "+" : ""}${(cpmRelSlope * 100).toFixed(1)}%/day).`,
  ];
  if (cappedByEnd) {
    evidence.push(`Ad set / campaign ends in ~${endsInDays} days, which caps the half-life.`);
  } else if (daysToFatigue !== null) {
    evidence.push(daysToFatigue === 0 ? "CTR has already fallen past the fatigue floor." : `At this decline, ~${daysToFatigue} days to the fatigue floor.`);
  }

  return { sufficiency: "ok", windowDays, index, state, trajectory, signals: { frequency: frequencySignal, ctrDecay: decaySignal, cpmRise: cpmRiseSignal }, daysToFatigue, evidence };
}
