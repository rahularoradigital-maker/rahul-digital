// Configurable follower tiers. There is NO universal definition - a "micro" creator in the US is a
// different follower count than in India, and a brand may want its own bands. So bands are data, not
// constants: a default is provided but any caller (platform/geo/campaign/brand) can pass its own. Pure.

import type { Tier, TierBands } from "./types";

// Sensible Instagram defaults (upper bound of each band; anything above macro is mega). Override per context.
export const DEFAULT_TIER_BANDS: TierBands = { nano: 10_000, micro: 100_000, mid: 500_000, macro: 1_000_000 };

/** Which tier a follower count falls into, given the bands in effect. */
export function tierOf(followers: number, bands: TierBands = DEFAULT_TIER_BANDS): Tier {
  if (followers < bands.nano) return "nano";
  if (followers < bands.micro) return "micro";
  if (followers < bands.mid) return "mid";
  if (followers < bands.macro) return "macro";
  return "mega";
}

/** The [min, max) follower range for a tier under the given bands (max = Infinity for mega). */
export function tierRange(tier: Tier, bands: TierBands = DEFAULT_TIER_BANDS): { min: number; max: number } {
  switch (tier) {
    case "nano": return { min: 0, max: bands.nano };
    case "micro": return { min: bands.nano, max: bands.micro };
    case "mid": return { min: bands.micro, max: bands.mid };
    case "macro": return { min: bands.mid, max: bands.macro };
    case "mega": return { min: bands.macro, max: Infinity };
  }
}
