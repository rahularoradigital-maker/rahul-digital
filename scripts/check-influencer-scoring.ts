// Runnable check for the Influencer Hunt scoring engines. Enforces: brand-fit is relevance not reach,
// audience-fit inherits the (capped) audience-estimate confidence, everything decomposes to explainable
// components, and no score is fabricated when inputs are missing. Run:
// node --experimental-strip-types scripts/check-influencer-scoring.ts
import assert from "node:assert/strict";
import { unknown, evidence, type NormalizedCreator, type BrandTarget, type AudienceEstimate } from "../lib/influencer/types.ts";
import { audienceFit } from "../lib/influencer/scoring/audience-fit.ts";
import { brandFit } from "../lib/influencer/scoring/brand-fit.ts";
import { scoreCreator } from "../lib/influencer/scoring/quality.ts";
import { risk } from "../lib/influencer/scoring/risk.ts";
import { engagementScore } from "../lib/influencer/scoring/engagement.ts";
import { reachScore } from "../lib/influencer/scoring/reach.ts";
import { consistencyScore } from "../lib/influencer/scoring/consistency.ts";
import type { ReelSignals } from "../lib/influencer/types.ts";

const NOW = "2026-08-29";
function creator(over: Partial<NormalizedCreator> = {}, audience?: Partial<AudienceEstimate>): NormalizedCreator {
  const aud: AudienceEstimate = { topCountries: [], genderLean: null, topLanguages: [], basis: "none", sampleSize: 0, source: "UNKNOWN", confidence: "none", note: "", ...audience };
  return {
    identity: { platform: "instagram", platformUserId: "1", handle: "x", profileUrl: "" },
    name: evidence("Fashion Creator", "PROVIDER", "high", NOW),
    bio: evidence("women ethnic wear kurta saree styling festive", "PUBLIC_WEB", "medium", NOW),
    followers: evidence(120_000, "PROVIDER", "high", NOW),
    following: evidence(800, "PROVIDER", "high", NOW),
    postsCount: evidence(400, "PROVIDER", "medium", NOW),
    verified: evidence(true, "PROVIDER", "high", NOW),
    accountType: evidence("creator", "PROVIDER", "medium", NOW),
    creatorCountry: evidence("IN", "PROVIDER", "medium", NOW),
    creatorLanguage: evidence("hi", "PROVIDER", "low", NOW),
    avgLikes: evidence(4000, "CALCULATED", "medium", NOW),
    avgComments: evidence(120, "CALCULATED", "medium", NOW),
    avgViews: unknown(),
    engagementRate: evidence(0.034, "CALCULATED", "medium", NOW),
    engagementMethod: "(likes+comments)/followers over last 12 posts",
    businessEmail: unknown(),
    audience: aud,
    ...over,
  };
}

const target: BrandTarget = {
  category: "women's ethnic wear", keyProducts: ["kurta sets", "sarees"], targetCountry: "IN",
  languages: ["hi", "en"], personaGender: "f", tone: "festive elegant",
  requiredFormats: ["video", "ugc"], contentKeywords: ["festive", "styling", "kurta"], competitors: [],
};

// Brand-fit: RELEVANCE, not reach. A relevant nano must beat a giant irrelevant creator.
const relevantNano = creator({ followers: evidence(6_000, "PROVIDER", "high", NOW) }, { topCountries: [{ countryCode: "IN", share: 0.8 }], basis: "commenter-sample", sampleSize: 50, source: "INFERENCE", confidence: "medium", note: "n=50" });
const hugeIrrelevant = creator({ followers: evidence(3_000_000, "PROVIDER", "high", NOW), bio: evidence("crypto trading finance stocks", "PUBLIC_WEB", "medium", NOW) });
assert.ok(brandFit(relevantNano, target).score > brandFit(hugeIrrelevant, target).score, "a relevant nano must out-score a huge irrelevant creator (follower count excluded)");
assert.ok(!brandFit(relevantNano, target).components.some((c) => /follower|reach/i.test(c.key)), "brand-fit must not include a follower/reach component");

// Audience-fit inherits the estimate's (capped) confidence - never more confident than its data.
const goodAud = creator({}, { topCountries: [{ countryCode: "IN", share: 0.75 }], topLanguages: [{ language: "hi", share: 0.6 }], genderLean: { female: 0.7, male: 0.3 }, basis: "commenter-sample", sampleSize: 60, source: "INFERENCE", confidence: "medium", note: "n=60" });
const af = audienceFit(goodAud, target);
assert.equal(af.confidence, "medium", "audience-fit is at most 'medium' (a proxy is never 'high')");
assert.ok(af.score > 60, "strong India/female/hindi alignment scores high");
// No audience signal -> audience-fit is not fabricated (score 0, confidence none).
const noAud = audienceFit(creator(), target);
assert.equal(noAud.confidence, "none");
assert.equal(noAud.score, 0);

// Risk: bought-looking engagement (40%) is flagged; a healthy 3.4% is not.
assert.ok(risk(creator({ engagementRate: evidence(0.4, "CALCULATED", "medium", NOW) })).score > 40, "40% ER reads as high risk");
assert.ok(risk(creator()).score < 30, "3.4% ER is a normal band");
// Risk anomaly line is reach-adjusted, consistent with the engagement + authenticity scorers: a 25% ER with
// no reach beyond followers is anomalous, but the SAME rate with 3x reach is expected (viral), not risky.
const reels25: ReelSignals = { avgViews: 300_000, reelEngagementRate: 0.06, reachRatio: 3, postsPerWeek: 4, daysSinceLastPost: 2, sampled: 12, source: "CALCULATED", confidence: "medium", note: "" };
const anomEng = risk(creator({ engagementRate: evidence(0.25, "CALCULATED", "medium", NOW) })).components.find((c) => c.key === "engagement_anomaly")!;
const viralEng = risk(creator({ engagementRate: evidence(0.25, "CALCULATED", "medium", NOW), reels: reels25 })).components.find((c) => c.key === "engagement_anomaly")!;
assert.ok(anomEng.score > 40, "25% ER at 1x reach is flagged anomalous by risk");
assert.equal(viralEng.score, 0, "25% ER at 3x reach is not a risk (reach explains it)");
assert.ok(/reach beyond followers/i.test(viralEng.reason), "risk explains the reach lift transparently");
assert.ok(risk(creator()).components.some((c) => c.key === "fake_followers" && c.confidence === "none"), "fake-follower % is UNKNOWN, never fabricated");

// Quality composite: fully decomposed + confidence = weakest usable sub-score.
const card = scoreCreator(goodAud, target);
assert.ok(card.quality.components.length === 7, "quality decomposes into 7 sub-scores (brand/audience/content/engagement/reach/consistency/safety)");
assert.ok(card.quality.score >= 0 && card.quality.score <= 100);
assert.ok(["low", "medium"].includes(card.quality.confidence), "composite confidence tracks the weakest usable input, capped by the proxy");

// --- Engagement QUALITY: implausibly-high (bought-looking) engagement must NOT out-score a healthy rate. ---
const eHealthy = engagementScore(creator({ engagementRate: evidence(0.06, "CALCULATED", "medium", NOW) })).score;
const eNano = engagementScore(creator({ engagementRate: evidence(0.12, "CALCULATED", "medium", NOW) })).score;
const eBought = engagementScore(creator({ engagementRate: evidence(0.40, "CALCULATED", "medium", NOW) })).score;
assert.ok(eBought < eHealthy, "40% engagement scores BELOW a healthy 6% (implausible rate penalized, not rewarded)");
assert.ok(eNano >= 90, "a legitimately high-engagement nano (12%) is NOT punished");
assert.ok(eHealthy >= 90, "a healthy 6% is a strong engagement score");
assert.ok(engagementScore(creator({ engagementRate: evidence(0.40, "CALCULATED", "medium", NOW) })).components.some((c) => /implausibly high/i.test(c.reason)), "implausible engagement is flagged transparently");

// --- No double-count: audience is a top-level quality component, so brand-fit must NOT also carry audience. ---
assert.ok(!brandFit(goodAud, target).components.some((c) => /audience/i.test(c.key)), "brand-fit no longer double-counts audience");

// --- Recent posts drive relevance: an off-topic BIO but on-brand POSTS must score on the posts, not read 0. ---
const offBio = creator({ bio: evidence("just vibes ✨", "PUBLIC_WEB", "medium", NOW) });
const onTopicPosts = ["festive kurta styling saree ethnic ootd reel", "new ethnic wear haul with kurta sets"];
const withPosts = scoreCreator(offBio, target, undefined, onTopicPosts);
const bioOnly = scoreCreator(offBio, target);
assert.ok(withPosts.brandFit.score > bioOnly.brandFit.score, "on-brand recent posts raise brand fit above a bio-only read");
assert.ok(withPosts.contentFit.score > bioOnly.contentFit.score, "on-brand recent posts raise content fit");
assert.ok(withPosts.quality.score > bioOnly.quality.score, "overall quality reflects real post relevance, not just the bio");

// --- Reel signals: reach (views/followers) + consistency + reel engagement are scored, and drive quality. ---
const reels = (over: Partial<ReelSignals>): ReelSignals => ({ avgViews: 100_000, reelEngagementRate: 0.05, reachRatio: 1.2, postsPerWeek: 3, daysSinceLastPost: 3, sampled: 12, source: "CALCULATED", confidence: "medium", note: "from 12 reels", ...over });

// Reach: content that travels beyond followers (2x) beats content that barely reaches them (0.2x).
assert.ok(reachScore(creator({ reels: reels({ reachRatio: 2 }) })).score > reachScore(creator({ reels: reels({ reachRatio: 0.2 }) })).score, "higher reel reach ratio scores higher");
assert.equal(reachScore(creator()).confidence, "none", "no reels -> reach is UNKNOWN, not a fabricated 0-with-confidence");

// Consistency: a fresh, frequent poster beats a dormant one.
assert.ok(consistencyScore(creator({ reels: reels({ daysSinceLastPost: 2, postsPerWeek: 4 }) })).score > consistencyScore(creator({ reels: reels({ daysSinceLastPost: 40, postsPerWeek: 0.2 }) })).score, "active+frequent beats dormant+sporadic");

// Reel engagement enriches the engagement score (a creator with reels has a 2-part engagement read).
assert.ok(engagementScore(creator({ reels: reels({}) })).components.length === 2, "engagement blends post + reel rates when reels exist");
assert.ok(engagementScore(creator({ reels: null })).components.length === 1, "engagement is post-only when no reels");

// Quality reflects the reel layer: a strong-reach, consistent creator outranks the same creator with no reels.
const withReels = scoreCreator(creator({ reels: reels({ reachRatio: 1.8, daysSinceLastPost: 2, postsPerWeek: 4 }) }), target);
const noReels = scoreCreator(creator({ reels: null }), target);
assert.ok(withReels.quality.score > noReels.quality.score, "strong reel reach + consistency lift the overall quality");

console.log("PASS: influencer scoring (brand-fit is relevance not reach, honest confidence, no fabrication)");
