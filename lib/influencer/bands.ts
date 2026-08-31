// Follower-size bands for the Influencer Hunt page filter, so the user sets the size range they want and
// excludes micro-brands / mega pages. Pure. This is a DISPLAY filter over an already-ranked run (instant, no
// extra provider credits); re-running refreshes the underlying data.

export type Band = { key: string; label: string; min: number; max: number };

export const BANDS: Band[] = [
  { key: "all", label: "All sizes", min: 0, max: Infinity },
  { key: "10-50k", label: "10K–50K", min: 10_000, max: 50_000 },
  { key: "50-500k", label: "50K–500K", min: 50_000, max: 500_000 },
  { key: "500k+", label: "500K+", min: 500_000, max: Infinity },
];

export function bandOf(key?: string | null): Band {
  return BANDS.find((b) => b.key === key) ?? BANDS[0];
}

/** Is this follower count in the band? Unknown followers only show under "All" (never guessed into a band). */
export function inBand(followers: number | null, b: Band): boolean {
  if (followers == null) return b.key === "all";
  return followers >= b.min && (b.max === Infinity || followers <= b.max);
}
