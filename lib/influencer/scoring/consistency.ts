// Consistency: is the creator ACTIVE and posting regularly? A dormant account (no recent reel) or a sporadic
// one is a weaker, riskier partner than one that ships every week. Blends recency (days since last reel) and
// cadence (reels/week), both computed from real reel timestamps. Confidence inherits the reel sample's. Pure.

import type { NormalizedCreator, TransparentScore, ScoreComponent } from "../types.ts";
import { compose } from "./util.ts";

// Recency: fresh (<=7d) is full marks; decays to 0 by ~45d dormant.
function recencyScore(days: number): number {
  if (days <= 7) return 100;
  if (days >= 45) return 0;
  return Math.round(100 * (1 - (days - 7) / 38));
}
// Cadence: 0.5/wk->40, 1->60, 2->80, 3+->~95. Diminishing returns (posting 10x/day is not 10x better).
function cadenceScore(perWeek: number): number {
  if (perWeek <= 0) return 0;
  return Math.min(100, Math.round(100 * (1 - Math.exp(-perWeek / 1.6))));
}

export function consistencyScore(creator: NormalizedCreator): TransparentScore {
  const r = creator.reels;
  if (!r || r.confidence === "none") {
    return compose([{ key: "consistency", score: 0, weight: 1, confidence: "none", reason: "no recent-post data" }], "Consistency unknown.");
  }
  const components: ScoreComponent[] = [];
  if (r.daysSinceLastPost != null) components.push({ key: "recency", score: recencyScore(r.daysSinceLastPost), weight: 0.5, confidence: r.confidence, reason: `last reel ${r.daysSinceLastPost}d ago` });
  else components.push({ key: "recency", score: 0, weight: 0.5, confidence: "none", reason: "no recency signal" });
  if (r.postsPerWeek != null) components.push({ key: "cadence", score: cadenceScore(r.postsPerWeek), weight: 0.5, confidence: r.confidence, reason: `~${r.postsPerWeek} reels/week` });
  else components.push({ key: "cadence", score: 0, weight: 0.5, confidence: "none", reason: "no cadence signal" });
  return compose(components, "Consistency = recency + posting cadence (from recent reels).");
}
