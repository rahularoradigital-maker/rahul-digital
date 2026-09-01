// Authenticity: a BRAND-INDEPENDENT "is this a real, healthy creator?" read, 0..100 (higher = more authentic).
// This is the free, public-data proxy for what HypeAuditor/Modash sell as an "audience quality" score. We
// CANNOT see fake-follower % without a paid audience provider (that stays UNKNOWN, never a fabricated number),
// but we CAN read the public anomalies that inflated accounts leave behind:
//   - implausibly high engagement  -> bought engagement
//   - like-heavy / comment-poor    -> inflated likes (a real audience actually comments)
//   - mass-following ratio         -> follow/unfollow growth hacking
//   - near-zero reel reach         -> ghost followers who never see the content
// Each is a transparent, confidence-carrying component; missing inputs DROP OUT (compose renormalizes) rather
// than dragging the score down or being guessed. Pure. It does NOT feed the brand-fit ranking - it is a
// separate lens, shown alongside, and offered as an optional "minimum authenticity" filter.

import type { NormalizedCreator, TransparentScore, ScoreComponent } from "../types.ts";
import { compose } from "./util.ts";

const IMPLAUSIBLE_ER = 0.15; // follower ER above this is far more likely bought than genuinely better

/** Engagement AUTHENTICITY (not magnitude): healthy in the plausible band, penalised only for the inflated
 * pattern (implausibly high). A LOW rate is NOT punished here - low engagement is normal for big accounts and
 * is judged separately by the size benchmark; authenticity only flags the anomaly, not the ambition. */
function engagementAuthenticity(er: number): number {
  if (er <= 0) return 0;
  if (er < 0.003) return 55; // very low: mild ghost-audience suspicion, but low ER is often just a large account
  if (er <= IMPLAUSIBLE_ER) return 88; // healthy, real band
  // Past plausible: decline toward 15 as it climbs to ~2x the ceiling (clearly bought).
  return Math.max(15, Math.round(88 - ((er - IMPLAUSIBLE_ER) / IMPLAUSIBLE_ER) * 73));
}

/** Comment authenticity from the comment share of interactions. Bought engagement is overwhelmingly likes,
 * so a near-zero comment share reads inflated; a healthy share reads real; comment-pod spam (very high) is
 * mildly suspect too. ponytail: heuristic band, known ceiling - real tell is the near-zero end; ledger-tunable. */
function commentAuthenticity(share: number): number {
  if (share < 0.003) return 42; // <0.3% of interactions are comments -> like-heavy, possibly inflated
  if (share <= 0.08) return 90; // healthy conversational band
  if (share <= 0.15) return 72;
  return 55; // unusually comment-heavy -> possible comment pod
}

export function authenticityScore(creator: NormalizedCreator): TransparentScore {
  const components: ScoreComponent[] = [];

  // 1. Engagement authenticity (follower ER shape).
  const er = creator.engagementRate.value;
  if (er != null && creator.engagementRate.confidence !== "none") {
    const inflated = er > IMPLAUSIBLE_ER;
    components.push({
      key: "engagement_authenticity", score: engagementAuthenticity(er), weight: 0.35, confidence: creator.engagementRate.confidence,
      reason: `engagement ${(er * 100).toFixed(1)}% ${inflated ? "is implausibly high (likely inflated)" : er < 0.003 ? "is very low for the follower base" : "is in a healthy real band"}`,
    });
  } else {
    components.push({ key: "engagement_authenticity", score: 0, weight: 0.35, confidence: "none", reason: "no engagement data to judge" });
  }

  // 2. Comment authenticity (comment share of interactions).
  const likes = creator.avgLikes.value;
  const comments = creator.avgComments.value;
  if (likes != null && comments != null && likes + comments > 0 && creator.avgLikes.confidence !== "none" && creator.avgComments.confidence !== "none") {
    const share = comments / (likes + comments);
    components.push({
      key: "comment_authenticity", score: commentAuthenticity(share), weight: 0.3, confidence: "medium",
      reason: `${(share * 100).toFixed(1)}% of interactions are comments ${share < 0.003 ? "(like-heavy - a real audience comments more)" : "(healthy conversational share)"}`,
    });
  } else {
    components.push({ key: "comment_authenticity", score: 0, weight: 0.3, confidence: "none", reason: "no likes/comments split to judge comment authenticity" });
  }

  // 3. Follow-ratio health (mass-following is a growth-hack tell).
  const f = creator.followers.value;
  const g = creator.following.value;
  if (f != null && g != null && f > 0 && creator.following.confidence !== "none") {
    const ratio = g / f;
    const score = ratio <= 1 ? 95 : ratio <= 2 ? 60 : 25;
    components.push({ key: "follow_ratio_health", score, weight: 0.2, confidence: "medium", reason: `following/followers = ${ratio.toFixed(2)}${ratio > 2 ? " (mass-following)" : ratio > 1 ? " (elevated)" : " (healthy)"}` });
  } else {
    components.push({ key: "follow_ratio_health", score: 0, weight: 0.2, confidence: "none", reason: "no follower/following counts to judge" });
  }

  // 4. Reach realness (do real people actually watch the content?).
  const reach = creator.reels?.reachRatio ?? null;
  if (reach != null && creator.reels && creator.reels.confidence !== "none") {
    const score = reach >= 0.5 ? 90 : reach >= 0.15 ? 65 : 40;
    components.push({ key: "reach_realness", score, weight: 0.15, confidence: creator.reels.confidence, reason: `reels reach ${reach.toFixed(2)}x followers ${reach < 0.15 ? "(few views vs followers - possible ghost audience)" : "(a real audience is watching)"}` });
  } else {
    components.push({ key: "reach_realness", score: 0, weight: 0.15, confidence: "none", reason: "no reel reach data to judge" });
  }

  return compose(components, "Authenticity from public anomaly signals only (engagement shape, comment share, follow ratio, reel reach). Fake-follower % needs a paid audience provider and stays unknown.");
}
