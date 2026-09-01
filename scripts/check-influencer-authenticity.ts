// Runnable check for the Phase 2 creator-quality signals: the brand-independent authenticity proxy and the
// engagement-vs-size benchmark. Proves: bought engagement + like-heavy + mass-following + ghost-reach are
// scored DOWN; a healthy creator scores UP; missing inputs drop out (compose renormalizes) and are never
// fabricated; the benchmark classifies above/typical/below by tier and returns null on unknown inputs.
// Run: node --experimental-strip-types scripts/check-influencer-authenticity.ts
import assert from "node:assert/strict";
import { unknown, evidence, type NormalizedCreator, type AudienceEstimate, type ReelSignals } from "../lib/influencer/types.ts";
import { authenticityScore } from "../lib/influencer/scoring/authenticity.ts";
import { engagementBenchmark } from "../lib/influencer/scoring/benchmark.ts";
import { plausibleErCeil, isImplausibleEr } from "../lib/influencer/scoring/engagement.ts";

const NOW = "2026-09-01";
function reels(over: Partial<ReelSignals> = {}): ReelSignals {
  return { avgViews: 200_000, reelEngagementRate: 0.05, reachRatio: 1.4, postsPerWeek: 4, daysSinceLastPost: 2, sampled: 12, source: "CALCULATED", confidence: "medium", note: "", ...over };
}
function creator(over: Partial<NormalizedCreator> = {}): NormalizedCreator {
  const aud: AudienceEstimate = { topCountries: [], genderLean: null, topLanguages: [], basis: "none", sampleSize: 0, source: "UNKNOWN", confidence: "none", note: "" };
  return {
    identity: { platform: "instagram", platformUserId: "1", handle: "x", profileUrl: "" },
    name: evidence("Real Creator", "PROVIDER", "high", NOW),
    bio: evidence("fashion creator", "PUBLIC_WEB", "medium", NOW),
    followers: evidence(120_000, "PROVIDER", "high", NOW),
    following: evidence(600, "PROVIDER", "high", NOW),
    postsCount: evidence(400, "PROVIDER", "medium", NOW),
    verified: evidence(true, "PROVIDER", "high", NOW),
    accountType: evidence("creator", "PROVIDER", "medium", NOW),
    creatorCountry: unknown(), creatorLanguage: unknown(),
    avgLikes: evidence(3600, "CALCULATED", "medium", NOW),
    avgComments: evidence(120, "CALCULATED", "medium", NOW), // ~3.2% comment share = healthy
    avgViews: unknown(),
    engagementRate: evidence(0.031, "CALCULATED", "medium", NOW),
    engagementMethod: "(likes+comments)/followers",
    businessEmail: unknown(),
    reels: reels(),
    audience: aud,
    ...over,
  };
}

// --- Healthy creator scores high and is HIGH confidence-worthy (all four components usable). ---
const healthy = authenticityScore(creator());
assert.ok(healthy.score >= 80, `healthy creator authentic (got ${healthy.score})`);
assert.equal(healthy.components.filter((c) => c.confidence !== "none").length, 4, "all four signals usable for a full creator");

// --- Bought engagement (60% ER) is scored DOWN. ---
const bought = authenticityScore(creator({ engagementRate: evidence(0.6, "CALCULATED", "medium", NOW) }));
const boughtEng = bought.components.find((c) => c.key === "engagement_authenticity")!;
assert.ok(boughtEng.score <= 20, `bought engagement flagged (got ${boughtEng.score})`);
assert.ok(bought.score < healthy.score, "bought account less authentic than healthy");

// --- Like-heavy / comment-poor (0.1% comment share) is scored DOWN on comment authenticity. ---
const likeHeavy = authenticityScore(creator({ avgLikes: evidence(50_000, "CALCULATED", "medium", NOW), avgComments: evidence(30, "CALCULATED", "medium", NOW) }));
const cmt = likeHeavy.components.find((c) => c.key === "comment_authenticity")!;
assert.ok(cmt.score <= 45, `like-heavy comment share flagged (got ${cmt.score})`);

// --- Mass-following (following 3x followers) is scored DOWN on follow-ratio health. ---
const mass = authenticityScore(creator({ followers: evidence(20_000, "PROVIDER", "high", NOW), following: evidence(60_000, "PROVIDER", "high", NOW) }));
const fr = mass.components.find((c) => c.key === "follow_ratio_health")!;
assert.ok(fr.score <= 30, `mass-following flagged (got ${fr.score})`);

// --- Ghost reach (near-zero views vs followers) is scored DOWN on reach realness. ---
const ghost = authenticityScore(creator({ reels: reels({ reachRatio: 0.05 }) }));
const rr = ghost.components.find((c) => c.key === "reach_realness")!;
assert.ok(rr.score <= 45, `ghost reach flagged (got ${rr.score})`);

// --- No fabrication: a creator with only followers (no ER, no likes/comments, no reels) yields the missing
//     components at confidence "none" so they DROP OUT, and never invents a value. ---
const bare = authenticityScore(creator({ engagementRate: unknown(), avgLikes: unknown(), avgComments: unknown(), reels: null, following: unknown() }));
assert.equal(bare.components.filter((c) => c.confidence !== "none").length, 0, "no usable authenticity signal -> nothing fabricated");
assert.equal(bare.confidence, "none", "bare creator authenticity is honestly unknown");

// --- Benchmark: classifies by tier and never fabricates on unknown inputs. ---
assert.equal(engagementBenchmark(120_000, 0.031)!.verdict, "above", "3.1% at 120K is above the 50K–500K band");
assert.equal(engagementBenchmark(120_000, 0.015)!.verdict, "typical", "1.5% at 120K is typical");
assert.equal(engagementBenchmark(120_000, 0.006)!.verdict, "below", "0.6% at 120K is below typical");
assert.equal(engagementBenchmark(2_000_000, 0.012)!.verdict, "typical", "1.2% at 2M is typical for mega");
assert.equal(engagementBenchmark(null, 0.03), null, "unknown followers -> no benchmark, not a guess");
assert.equal(engagementBenchmark(120_000, null), null, "unknown ER -> no benchmark, not a guess");
assert.equal(engagementBenchmark(30_000, 0.02)!.tierLabel, "10K–50K", "tier label picked by follower count");

// --- Reach-adjusted plausibility: the plausible follower-ER ceiling scales with reach beyond the follower
//     base, so a viral creator's high follower-ER is credited as EXPECTED, not penalised as inflated. ---
assert.equal(plausibleErCeil(null), 0.15, "no reach data -> base plausible ceiling (15%)");
assert.equal(plausibleErCeil(1), 0.15, "reach 1x -> base ceiling");
assert.ok(Math.abs(plausibleErCeil(2.5) - 0.375) < 1e-9, "reach 2.5x lifts the ceiling proportionally to 37.5%");
assert.equal(plausibleErCeil(100), 0.6, "reach multiplier is capped at 4x (ceiling never exceeds 60%)");
// The exact Sakshi case: 17.6% follower ER at 2.5x reach is plausible; the same rate at 1x reach is not.
assert.equal(isImplausibleEr(0.176, 2.5), false, "17.6% ER at 2.5x reach is plausible (viral reach explains it)");
assert.equal(isImplausibleEr(0.176, null), true, "17.6% ER with no reach beyond followers is implausible");

// A 30% follower ER: penalised at 1x reach, credited at 3x reach - and the lift is explained transparently.
const noReach = authenticityScore(creator({ engagementRate: evidence(0.3, "CALCULATED", "medium", NOW), reels: reels({ reachRatio: 1 }) }));
const withReach = authenticityScore(creator({ engagementRate: evidence(0.3, "CALCULATED", "medium", NOW), reels: reels({ reachRatio: 3 }) }));
const noReachEng = noReach.components.find((c) => c.key === "engagement_authenticity")!;
const withReachEng = withReach.components.find((c) => c.key === "engagement_authenticity")!;
assert.ok(noReachEng.score <= 60, `30% ER at 1x reach reads as inflated (got ${noReachEng.score})`);
assert.equal(withReachEng.score, 88, "30% ER at 3x reach is credited as expected, not inflated");
assert.ok(/reach beyond followers/i.test(withReachEng.reason), "the reach lift is explained transparently");
assert.ok(withReach.score > noReach.score, "reach beyond followers raises overall authenticity for a viral creator");

console.log("PASS: influencer authenticity proxy + engagement-vs-size benchmark + reach-adjusted plausibility (no fabrication)");
