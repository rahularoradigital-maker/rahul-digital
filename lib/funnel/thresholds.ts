// Funnel-diagnosis thresholds (pure). Two origins, kept honest and separate:
//
// GROUNDED in the funnel methodology (change these only with a reason):
//   - Spend floor: don't score an ad that has barely spent - the numbers are luck, not evidence.
//   - Materiality: a gap must clear 10% before it is called a leak (smaller is noise).
//   - Baseline: at least 3 same-objective ads, else "the best ad" is the ad itself and every gap is 0.
//
// PROJECT HEURISTICS (ours; overridable; NOT a sourced benchmark - never dressed up as one):
//   - Per-step volume floors: how big a denominator an ad needs before it may DEFINE the account bar for a
//     step. Without this, one ad with 2 carts on 2 page views scores 100% and becomes a target nothing can
//     reach. These are engineering defaults, not a rulebook constant.
//   - Thin fraction: below floor x this, the ad's OWN reading of a step is flagged too thin to trust.

export const SPEND_FLOOR: Record<string, number> = { INR: 300, USD: 5, GBP: 5, EUR: 5, DEFAULT: 5 };
export function spendFloorFor(currency: string | null | undefined): number {
  if (!currency) return SPEND_FLOOR.DEFAULT;
  return SPEND_FLOOR[currency.toUpperCase()] ?? SPEND_FLOOR.DEFAULT;
}

export const MATERIALITY_GAP_PCT = 10; // grounded: a leak must be at least 10% below own-best
export const MIN_BASELINE_ADS = 3; // grounded: fewer than 3 same-objective ads => no trustworthy bar
export const THIN_FRACTION = 0.25; // heuristic: denom < floor x 0.25 => the ad's own step reading is "thin"

// Per-step minimum denominator to DEFINE the account's own-best bar for that step (heuristic).
export const STEP_VOLUME_FLOOR: Record<string, number> = {
  link_ctr: 5000, // impressions
  lpv_rate: 100, // outbound/link clicks
  lpv_to_atc: 100, // landing page views
  atc_to_checkout: 25, // add to carts
  checkout_to_purchase: 25, // initiate checkouts
};
