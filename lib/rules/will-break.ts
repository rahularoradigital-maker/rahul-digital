// 7/14-day fatigue forecast per docs/product-spec/08-forecasting-framework.md.
// will-break.ts is the FORWARD sibling of fatigue.ts: it consumes the same daily
// rows, takes the coincident diagnosis from fatigueV2, and projects the leading
// trajectories (CTR decay, frequency rise) plus an age/burn hazard forward to
// estimate P(crossing into a worse fatigue state within the horizon).
// The one rule of spec 08 §0: a forecast is NOT a fact. Every ok result is
// labelled MODEL_ESTIMATE, and thin data gets a refusal, never a guess.

import type { MetricsRow } from "../ad-source.ts";
import { fatigueV2, FATIGUE_V2_CONFIG, clamp01 } from "./fatigue.ts";

export type WillBreakResult =
  | {
      status: "ok";
      probability: number; // 0-1, MODEL ESTIMATE — never OFFICIAL
      confidence: number; // 0-1, separate from probability (spec 08 §6)
      drivers: string[];
      expectedConsequence: string;
      recommendedAction: string;
      factLabel: "MODEL_ESTIMATE";
    }
  | { status: "insufficient_data" };

// All constants are v0 priors — calibrate-at-build against the account's own
// realised state transitions (spec 08 §4d); none is a validated benchmark.
export const WILL_BREAK_CONFIG = {
  MIN_ROWS: 7, // floor UNKNOWN (spec 08 §9); mirrors fatigue.ts's documented start
  WINDOW: 3, // slope fit = first 3 days vs last 3 days (robust, boring by design §4a)
  TREND_BLEND: 0.7, // calibrate-at-build: trend-extrapolation component weight (§4c)
  HAZARD_BLEND: 0.3, // calibrate-at-build: survival/hazard component weight (§4c)
  CTR_SLOPE_W: 0.6, // calibrate-at-build: leading attention slope weighted highest (§4c)
  FREQ_SLOPE_W: 0.4, // calibrate-at-build: saturation slope weight (§4c)
  AGE_REF_DAYS: 28, // calibrate-at-build: creative age at which the hazard age factor saturates
  // Farther extrapolation past the observed range earns strictly less trust
  // (§4a + KILLCRITIC weak-forecast guard): 14d confidence < 7d on identical data.
  HORIZON_CONFIDENCE: { 7: 0.9, 14: 0.7 },
  REFRESH_NOW: 0.7, // calibrate-at-build action cutoffs (§2 decision gate)
  QUEUE_REPLACEMENT: 0.4,
} as const;

/**
 * P(ad crosses into a worse fatigue state within horizonDays). MODEL ESTIMATE,
 * always with a confidence; refuses on <7 rows or an undiagnosable series.
 */
export function willBreak(rows: MetricsRow[], horizonDays: 7 | 14): WillBreakResult {
  const C = WILL_BREAK_CONFIG;
  if (rows.length < C.MIN_ROWS) return { status: "insufficient_data" };

  // Anchor to the observed diagnosis (spec 08 §1): no diagnosis, no forecast.
  const diag = fatigueV2(rows);
  if (diag.status !== "ok") return { status: "insufficient_data" };

  const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const first = ordered.slice(0, C.WINDOW);
  const last = ordered.slice(-C.WINDOW);
  const span = ordered.length - C.WINDOW; // days between window centres, >= 4
  const sum = (xs: MetricsRow[], f: (r: MetricsRow) => number) => xs.reduce((a, r) => a + f(r), 0);
  const avg = (xs: MetricsRow[], f: (r: MetricsRow) => number) => sum(xs, f) / xs.length;

  // IN1 frequency trajectory: normalised rise per day (only risk-increasing part).
  const freqFirst = avg(first, (r) => r.frequency);
  const freqLast = avg(last, (r) => r.frequency);
  const freqSlope = Math.max(0, (freqLast - freqFirst) / span) / FATIGUE_V2_CONFIG.FREQ_CAP;

  // IN3 CTR decay: relative decay per day vs the ad's OWN baseline (never an
  // industry number). Zero when the baseline is unmeasurable.
  const imprFirst = sum(first, (r) => r.impressions);
  const imprLast = sum(last, (r) => r.impressions);
  const ctrFirst = imprFirst > 0 ? sum(first, (r) => r.clicks) / imprFirst : 0;
  const ctrLast = imprLast > 0 ? sum(last, (r) => r.clicks) / imprLast : 0;
  const ctrSlope = ctrFirst > 0 ? Math.max(0, (ctrFirst - ctrLast) / ctrFirst) / span : 0;

  // §4a Component 1 — trend extrapolation: project the fatigue index forward at
  // the leading-signal decay rate. Deliberately a linear projection, not a curve
  // fit that would overfit a two-week series.
  const indexSlopePerDay = C.CTR_SLOPE_W * ctrSlope + C.FREQ_SLOPE_W * freqSlope;
  const projectedIndex = clamp01(diag.index + indexSlopePerDay * horizonDays);

  // §4b Component 2 — hazard framing: risk rises with the current index, creative
  // age (row count as the age proxy, M1 — no first-seen snapshot store yet) and
  // spend acceleration (burn proxy, M2). Mix is calibrate-at-build.
  const ageFactor = clamp01(ordered.length / C.AGE_REF_DAYS);
  const spendFirst = avg(first, (r) => r.spend);
  const burnFactor = spendFirst > 0 ? clamp01(avg(last, (r) => r.spend) / spendFirst - 1) : 0;
  const hazard = clamp01(0.6 * diag.index + 0.25 * ageFactor + 0.15 * burnFactor);

  // §4c blend. ponytail: uncalibrated linear blend, ceiling = no isotonic
  // calibration against realised crossings yet (§4d); upgrade when labelled
  // account history accrues.
  const probability = clamp01(C.TREND_BLEND * projectedIndex + C.HAZARD_BLEND * hazard);

  // §6: confidence is independent of probability. It inherits the diagnosis
  // confidence (signal coverage + sample depth) and is discounted per horizon —
  // strictly lower at 14d than 7d on the same data.
  const confidence = clamp01(diag.confidence * C.HORIZON_CONFIDENCE[horizonDays]);

  const drivers: string[] = [];
  if (ctrSlope > 0) drivers.push(`CTR decaying ~${(ctrSlope * 100).toFixed(1)}% of baseline per day`);
  if (freqSlope > 0) drivers.push(`frequency rising ~${(freqSlope * FATIGUE_V2_CONFIG.FREQ_CAP).toFixed(2)}/day`);
  for (const d of diag.drivers) if (drivers.length < 5 && !drivers.includes(d)) drivers.push(d);
  if (drivers.length === 0) drivers.push(`fatigue index ${diag.index.toFixed(2)} with a flat trajectory`);

  const recommendedAction =
    probability >= C.REFRESH_NOW ? "refresh_now"
    : probability >= C.QUEUE_REPLACEMENT ? "queue_replacement"
    : "watch";
  const expectedConsequence =
    probability >= C.QUEUE_REPLACEMENT
      ? `At the current trajectory, CPA and cost per result are likely to worsen as the ad crosses into a worse fatigue state within ${horizonDays} days (MODEL ESTIMATE, not a fact).`
      : `Little change expected within ${horizonDays} days at the current trajectory (MODEL ESTIMATE, not a fact).`;

  return {
    status: "ok",
    probability,
    confidence,
    drivers,
    expectedConsequence,
    recommendedAction,
    factLabel: "MODEL_ESTIMATE",
  };
}
