// Risk: authenticity/anomaly read from public data. HIGHER score = MORE risk. We can see an implausible
// engagement rate (bought engagement runs very high; a dead account near zero) and a mass-follow ratio. We
// CANNOT see fake-follower % without a specialist provider, so that stays UNKNOWN (never a fabricated 0%). Pure.

import type { NormalizedCreator, TransparentScore, ScoreComponent } from "../types.ts";
import { compose } from "./util.ts";

export function risk(creator: NormalizedCreator): TransparentScore {
  const components: ScoreComponent[] = [];

  const er = creator.engagementRate.value;
  if (er != null && creator.engagementRate.confidence !== "none") {
    let r = 0;
    if (er > 0.2) r = Math.min(100, Math.round((er - 0.2) / 0.3 * 100) + 40);
    else if (er < 0.002) r = 60;
    components.push({ key: "engagement_anomaly", score: r, weight: 0.5, confidence: creator.engagementRate.confidence, reason: `engagement rate ${(er * 100).toFixed(1)}% ${r > 40 ? "is anomalous" : "is in a normal band"}` });
  } else {
    components.push({ key: "engagement_anomaly", score: 0, weight: 0.5, confidence: "none", reason: "no engagement data to judge" });
  }

  const f = creator.followers.value;
  const g = creator.following.value;
  if (f != null && g != null && f > 0) {
    const ratio = g / f;
    const r = ratio > 2 ? 70 : ratio > 1 ? 40 : 0;
    components.push({ key: "follow_ratio", score: r, weight: 0.3, confidence: creator.following.confidence === "none" ? "none" : "medium", reason: `following/followers = ${ratio.toFixed(2)}${r > 0 ? " (elevated)" : ""}` });
  } else {
    components.push({ key: "follow_ratio", score: 0, weight: 0.3, confidence: "none", reason: "no follower/following counts to judge" });
  }

  components.push({ key: "fake_followers", score: 0, weight: 0.2, confidence: "none", reason: "fake-follower analysis requires a specialist audience provider (not available in Path A)" });

  return compose(components, "Risk from public anomalies only; authenticity/fake-follower analysis needs a paid provider.");
}
