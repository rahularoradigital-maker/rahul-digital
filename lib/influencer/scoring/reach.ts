// Reach amplification: do the creator's reels travel BEYOND their own followers? Score = a curve over
// (avg reel views / followers). >1x means the content reaches more people than just the follower base - the
// single strongest organic-reach signal the PUBLIC scraper gives, and one a follower count alone can't. This
// is a big part of the "richer without a paid provider" gain. Confidence inherits the reel sample's. Pure.

import type { NormalizedCreator, TransparentScore } from "../types.ts";
import { compose } from "./util.ts";

// Diminishing-returns curve on the views/followers ratio: 0.3x->39, 0.6x->63, 1x->81, 2x->96.
function ratioToScore(ratio: number): number {
  if (ratio <= 0) return 0;
  return Math.min(100, Math.round(100 * (1 - Math.exp(-ratio / 0.6))));
}

export function reachScore(creator: NormalizedCreator): TransparentScore {
  const r = creator.reels;
  const ratio = r?.reachRatio ?? null;
  if (!r || ratio == null || r.confidence === "none") {
    return compose([{ key: "reach", score: 0, weight: 1, confidence: "none", reason: "no reel view data to judge reach" }], "Reach unknown (no reel views).");
  }
  return compose(
    [{ key: "reach", score: ratioToScore(ratio), weight: 1, confidence: r.confidence, reason: `avg reel views are ${ratio.toFixed(2)}x followers${ratio >= 1 ? " - travels beyond the follower base" : ""} (${r.note})` }],
    `Reach = avg reel views / followers = ${ratio.toFixed(2)}x.`,
  );
}
