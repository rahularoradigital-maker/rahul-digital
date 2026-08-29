// FATIGUE FORECAST: project the PROBABILITY that a creative is fatigued at +7 and +14 days.
//
// The day-wise engine (fatigue.ts) reads the PRESENT: a current fatigue index (0-100), a
// trajectory, and a half-life (daysToFatigue). This module turns that present read into a
// FORWARD-LOOKING probability. Everything here is PREDICTED / ESTIMATED, never OBSERVED: we
// never claim a creative WILL fatigue, only how likely it is under a simple linear drift of
// the current index.
//
// Method (deliberately simple, one senior-buyer heuristic, no model training):
//   1. Infer a daily drift of the fatigue index from the trajectory ("worsening" climbs a few
//      points/day, "stable" ~0, "improving" falls) and sharpen it with the half-life (a short
//      daysToFatigue means the index is racing to the floor, so drift must be at least fast
//      enough to get there in that many days).
//   2. Project futureIndex(h) = currentIndex + drift * h, clamped 0-100.
//   3. Map futureIndex through a logistic around the "fatigued" cut (75) into a probability.
//   4. If the half-life lands inside the horizon, bias the probability upward - the engine is
//      already saying it hits the floor within that window.
//
// Pure, no I/O, no deps. Imports use the project's .ts convention. One runnable check lives in
// scripts/check-fatigue-forecast.ts.

import type { FatigueRead } from "./fatigue.ts";

export type Horizon = { probability: number; band: "low" | "medium" | "high" }; // probability 0-1
export type FatigueForecast = {
  day7: Horizon;
  day14: Horizon;
  drivers: string[];
  confidence: number; // 0-1, lower when the current read is insufficient_data
  label: "PREDICTED";
  note: string;
};

// calibrate-at-build constants.
const FATIGUE_CUT = 75; // the fatigue index at which a creative is "fatigued" (matches fatigue.ts STATE_CUTS.fatiguing)
const LOGISTIC_SCALE = 12; // spread of the logistic in index points; ~one band per ~13 points
const DRIFT_BY_TRAJECTORY = { worsening: 3, stable: 0.25, improving: -2.5 } as const; // index points/day
const AT_FLOOR_DRIFT = 4; // drift floor when daysToFatigue === 0 (already at the fatigue floor, still climbing)
const HALF_LIFE_BIAS = 0.3; // fraction of the remaining headroom to add when the half-life is inside the horizon
const BAND_LOW = 0.33; // probability < this = low band
const BAND_HIGH = 0.66; // probability >= this = high band
const CONF_BASE = 0.35; // ok-read confidence floor
const CONF_PER_DAY = 1 / 28; // each connected day adds this much confidence...
const CONF_CAP = 0.9; // ...capped here: a projection is never fully certain
const CONF_INSUFFICIENT = 0.15; // confidence when the underlying read is insufficient_data
const HORIZONS = { day7: 7, day14: 14 } as const;

// signal thresholds (0-100 each) above which a signal is named as a driver.
const DRIVER_FREQUENCY = 50;
const DRIVER_DECAY = 40;
const DRIVER_CPM = 40;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function bandOf(p: number): Horizon["band"] {
  return p < BAND_LOW ? "low" : p < BAND_HIGH ? "medium" : "high";
}

// Logistic map of a projected index around the fatigued cut into a 0-1 probability.
function logisticProbability(futureIndex: number): number {
  return 1 / (1 + Math.exp(-(futureIndex - FATIGUE_CUT) / LOGISTIC_SCALE));
}

export function forecastFatigue(read: FatigueRead): FatigueForecast {
  // Insufficient data: we cannot project a trend. Emit a weak, low prior and say so plainly,
  // rather than fabricating a drift from noise.
  if (read.sufficiency === "insufficient_data") {
    const low: Horizon = { probability: clamp(logisticProbability(read.index), 0, 0.1), band: "low" };
    return {
      day7: { ...low },
      day14: { ...low },
      drivers: ["insufficient delivery history"],
      confidence: CONF_INSUFFICIENT,
      label: "PREDICTED",
      note: `PREDICTED with low confidence: only ${read.windowDays} day(s) of delivery, too few to project a fatigue trend. Treat as a weak prior, not a read.`,
    };
  }

  // 1. Infer daily drift of the fatigue index.
  let dailyDrift: number = DRIFT_BY_TRAJECTORY[read.trajectory];
  if (read.daysToFatigue !== null && read.daysToFatigue > 0) {
    // A short half-life implies fast drift: the index must move from here to the cut in that
    // many days. Take whichever is faster - the trajectory drift or this implied drift.
    const impliedDrift = (FATIGUE_CUT - read.index) / read.daysToFatigue;
    if (impliedDrift > dailyDrift) dailyDrift = impliedDrift;
  } else if (read.daysToFatigue === 0) {
    // Already at/below the fatigue floor: keep climbing hard.
    dailyDrift = Math.max(dailyDrift, AT_FLOOR_DRIFT);
  }

  const horizon = (h: number): Horizon => {
    const futureIndex = clamp(read.index + dailyDrift * h, 0, 100);
    let probability = logisticProbability(futureIndex);
    // 4. Half-life inside the horizon: the engine already says it hits the floor within h.
    if (read.daysToFatigue !== null && read.daysToFatigue <= h) {
      probability = probability + (1 - probability) * HALF_LIFE_BIAS;
    }
    probability = clamp(probability, 0, 1);
    return { probability, band: bandOf(probability) };
  };

  const day7 = horizon(HORIZONS.day7);
  const day14 = horizon(HORIZONS.day14);

  // 5. Name the biggest contributors, strongest first.
  const drivers: string[] = [];
  if (read.signals.frequency >= DRIVER_FREQUENCY) drivers.push("frequency saturation");
  if (read.signals.ctrDecay >= DRIVER_DECAY) drivers.push("declining primary metric");
  if (read.signals.cpmRise >= DRIVER_CPM) drivers.push("rising CPM (falling relevance)");
  if (read.daysToFatigue !== null && read.daysToFatigue > 0) drivers.push(`half-life ~${read.daysToFatigue} days`);
  else if (read.daysToFatigue === 0) drivers.push("already at the fatigue floor");
  if (read.trajectory === "worsening" && !drivers.includes("declining primary metric")) drivers.push("worsening trajectory");
  if (drivers.length === 0) drivers.push("no dominant fatigue driver yet");

  // 6. Confidence: grows with the length of the connected window, capped (a projection is never
  // certain). The read is sufficient here, so we start from CONF_BASE.
  const confidence = clamp(CONF_BASE + read.windowDays * CONF_PER_DAY, CONF_BASE, CONF_CAP);

  const note =
    `PREDICTED from a current fatigue index of ${read.index}/100 (${read.trajectory}) drifting ~${dailyDrift.toFixed(1)} pts/day. ` +
    `+7d ${(day7.probability * 100).toFixed(0)}% (${day7.band}), +14d ${(day14.probability * 100).toFixed(0)}% (${day14.band}). Estimated, not observed.`;

  return { day7, day14, drivers, confidence, label: "PREDICTED", note };
}

// FATIGUE FRAMING: re-express the structured fatigue read as a "named-ad + countdown + mechanism +
// cost impact" line (Yamin canon framing rule), instead of a bare score. This adds NO new math: it
// only names fields the engine already computed - the real days-to-line (read.daysToFatigue), the
// dominant driver (read.signals + trajectory), and defers the concrete cost numbers to
// read.evidence[0] ("<metric> X -> Y over N days (-Z%/day)"). It NEVER fabricates a future
// ROAS/CPA: the forecast projects a fatigue INDEX and a probability, not a predicted cost figure.

export type FatigueFrame = {
  hasSignal: boolean; // false when the read is insufficient_data -> show "not enough signal", never a fake number
  dated: boolean; // true only when there is a real numeric days-to-line to count down
  countdown: string; // "~5 days" | "now" | "no dated crossing yet" | "not enough signal yet"
  mechanism: string; // the dominant driver the engine computed, in plain English
  headline: string; // the full framed sentence
};

// Mirrors fatigue.ts WEIGHTS so the NAMED mechanism matches the index math (frequency/decay 0.4, cpm 0.2).
const MECH_WEIGHTS = { frequency: 0.4, ctrDecay: 0.4, cpmRise: 0.2 } as const;
const MECH_FLAT = 4; // below this weighted contribution no single driver is named (all signals ~flat)

// The dominant fatigue driver, in plain English. Canon-honest: frequency is framed as EXPOSURE
// saturating (Meta's published decay curve on exposure_n), never as a frequency ceiling. `named`
// is false when no signal is really moving (all flat) - a dated countdown then reflects the ad
// set's scheduled end, not a fatigue crossing, so the caller must not claim one.
function dominantMechanism(read: FatigueRead): { text: string; named: boolean } {
  const contribution = {
    frequency: MECH_WEIGHTS.frequency * read.signals.frequency,
    ctrDecay: MECH_WEIGHTS.ctrDecay * read.signals.ctrDecay,
    cpmRise: MECH_WEIGHTS.cpmRise * read.signals.cpmRise,
  };
  const top = Math.max(contribution.frequency, contribution.ctrDecay, contribution.cpmRise);
  if (top < MECH_FLAT) {
    return read.trajectory === "worsening"
      ? { text: "efficiency is slipping across the board", named: true }
      : { text: "no dominant fatigue driver yet", named: false };
  }
  if (contribution.frequency === top) return { text: "the same audience keeps seeing it (exposure saturating)", named: true };
  if (contribution.ctrDecay === top) return { text: "it is earning less per impression", named: true };
  return { text: "the auction is charging more to deliver it (relevance slipping)", named: true };
}

export function frameFatigue(read: FatigueRead): FatigueFrame {
  if (read.sufficiency === "insufficient_data") {
    const days = `${read.windowDays} day${read.windowDays === 1 ? "" : "s"}`;
    return {
      hasSignal: false,
      dated: false,
      countdown: "not enough signal yet",
      mechanism: `only ${days} of delivery`,
      headline: `Not enough signal yet: only ${days} of delivery, too few to forecast fatigue.`,
    };
  }
  const mech = dominantMechanism(read);
  const mechanism = mech.text;
  const d = read.daysToFatigue;
  if (d === 0) {
    return { hasSignal: true, dated: false, countdown: "now", mechanism, headline: `Already past the fatigue line because ${mechanism}.` };
  }
  if (d !== null && d > 0) {
    const n = `~${d} day${d === 1 ? "" : "s"}`;
    // A dated countdown with a real driver IS a fatigue crossing. With no moving driver, the date is
    // the ad set's scheduled end - report it as the effective half-life, never as a fatigue crossing.
    const headline = mech.named ? `Hits the fatigue line in ${n} because ${mechanism}.` : `Effective half-life ${n} (${mechanism}).`;
    return { hasSignal: true, dated: true, countdown: n, mechanism, headline };
  }
  // Sufficient read but no dated crossing: the primary metric is not declining toward the floor.
  return { hasSignal: true, dated: false, countdown: "no dated crossing yet", mechanism, headline: `Holding for now; ${mechanism}.` };
}
