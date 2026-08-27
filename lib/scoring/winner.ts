// Creative winner engine: ranks winners on MORE than ROAS. A high-ROAS tiny-spend
// fluke should not outrank a proven scaled workhorse, so we blend four independent
// reads - quality (good on its objective, still fresh), scale (how much proven spend
// it carries, log-scaled so whales do not dominate linearly), stability (steady,
// enough days, not fatigued) and opportunity (room to keep scaling). Pure, no I/O,
// no deps, no fabrication: every score traces to an input an upstream engine produced.

export type WinnerInput = {
  objectiveScore: number; // 0-100 absolute objective performance (already computed elsewhere)
  spendRs: number;
  roas: number | null;
  fatigueState: "fresh" | "watch" | "fatiguing" | "fatigued";
  stable: boolean;
  days: number; // days the ad has run
  halfLifeDays: number | null; // remaining creative half-life
};

export type WinnerScores = {
  quality: number; // 0-100: is it good on its objective + still fresh
  scale: number; // 0-100: how much proven spend it carries (log-scaled)
  stability: number; // 0-100: steady, enough days, not fatigued
  opportunity: number; // 0-100: room to scale (good + fresh + long half-life)
  overall: number; // 0-100 weighted blend
  label: "INTERNAL CALCULATION";
  why: string[];
};

// --- Calibrate-at-build constants (documented weights). Tune these, not the code. ---

// Overall blend. Quality leads (is it actually good), then proven scale, then how
// trustworthy the read is, then upside. Sums to 1.0.
const W_QUALITY = 0.4;
const W_SCALE = 0.25;
const W_STABILITY = 0.2;
const W_OPPORTUNITY = 0.15;

// Quality: multiply objectiveScore by a freshness factor. Fresh creative earns a
// light boost, fatigued creative is discounted (a good number on a burning-out ad
// is worth less than the same number on a fresh one).
const FRESHNESS_FACTOR: Record<WinnerInput["fatigueState"], number> = {
  fresh: 1.1,
  watch: 1.0,
  fatiguing: 0.85,
  fatigued: 0.6,
};

// Stability: a proven-stable ad starts here; an unstable one starts lower. On top we
// ramp trust with runtime (a 1-day ad is noise, ~14 days is a settled read).
const STABILITY_BASE_STABLE = 70;
const STABILITY_BASE_UNSTABLE = 35;
const STABILITY_DAY_RAMP_MAX = 30; // full day-ramp bonus at DAYS_TO_TRUST days
const DAYS_TO_TRUST = 14;
const STABILITY_FATIGUED_PENALTY = 40; // fatigued ads are not stable, whatever the days say

// Opportunity: only ads that are already good AND still fresh have real room to scale.
// Half-life is the headroom multiplier; unknown (null) is treated as neutral, not zero,
// so a missing signal neither rewards nor punishes.
const OPPORTUNITY_QUALITY_FLOOR = 55; // below this, "room to scale" is not a winner story
const HALF_LIFE_FULL_DAYS = 14; // half-life at/above this = full headroom
const HALF_LIFE_NEUTRAL = 0.6; // multiplier used when halfLifeDays is null (unknown)

const clamp = (n: number): number => Math.max(0, Math.min(100, n));

export function winnerScores(a: WinnerInput, accountMaxSpend: number): WinnerScores {
  // quality: objective performance, freshness-adjusted.
  const freshness = FRESHNESS_FACTOR[a.fatigueState];
  const quality = clamp(a.objectiveScore * freshness);

  // scale: log-scaled proven spend, normalised to the biggest spender in the account.
  // log so a 10x-spend whale does not score 10x - proof of spend has diminishing weight.
  const scale =
    accountMaxSpend > 0
      ? clamp((Math.log(1 + Math.max(0, a.spendRs)) / Math.log(1 + accountMaxSpend)) * 100)
      : 0;

  // stability: base on the stable flag, ramp with runtime, penalise fatigue.
  const base = a.stable ? STABILITY_BASE_STABLE : STABILITY_BASE_UNSTABLE;
  const dayRamp = Math.min(1, Math.max(0, a.days) / DAYS_TO_TRUST) * STABILITY_DAY_RAMP_MAX;
  const fatiguePenalty = a.fatigueState === "fatigued" ? STABILITY_FATIGUED_PENALTY : 0;
  const stability = clamp(base + dayRamp - fatiguePenalty);

  // opportunity: room to scale = good enough AND fresh AND long half-life ahead.
  const isFresh = a.fatigueState === "fresh" || a.fatigueState === "watch";
  const halfLifeMult =
    a.halfLifeDays == null
      ? HALF_LIFE_NEUTRAL
      : Math.min(1, Math.max(0, a.halfLifeDays) / HALF_LIFE_FULL_DAYS);
  const opportunity =
    quality >= OPPORTUNITY_QUALITY_FLOOR && isFresh ? clamp(quality * halfLifeMult) : 0;

  // overall: documented weighted blend, then clamped.
  const overall = clamp(
    W_QUALITY * quality + W_SCALE * scale + W_STABILITY * stability + W_OPPORTUNITY * opportunity,
  );

  // why: rank the four reads, name the top contributors so the dashboard can explain the rank.
  const parts: { label: string; value: number }[] = [
    { label: `Quality ${Math.round(quality)}`, value: W_QUALITY * quality },
    { label: `Proven scale ${Math.round(scale)}`, value: W_SCALE * scale },
    { label: `Stability ${Math.round(stability)}`, value: W_STABILITY * stability },
    { label: `Opportunity ${Math.round(opportunity)}`, value: W_OPPORTUNITY * opportunity },
  ];
  const why = parts
    .filter((p) => p.value > 0)
    .sort((x, y) => y.value - x.value)
    .slice(0, 3)
    .map((p) => p.label);
  if (a.fatigueState === "fatigued") why.push("Discounted: creative is fatigued");
  if (why.length === 0) why.push("No positive contributors");

  return {
    quality,
    scale,
    stability,
    opportunity,
    overall,
    label: "INTERNAL CALCULATION",
    why,
  };
}
