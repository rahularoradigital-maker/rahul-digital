// Runnable check for the ranking orchestrator. Enforces the load-bearing promises: dedup merges to the best
// evidence, hard spec gates reject (but missing data never rejects), and the RANK ORDER is the quality
// formula - a smaller, better-fit creator outranks a huge irrelevant one (reach must never dominate
// relevance). Run: node --experimental-strip-types scripts/check-influencer-rank.ts
import assert from "node:assert/strict";
import { unknown, evidence, type NormalizedCreator, type BrandTarget, type CreatorSearchSpec, type AudienceEstimate } from "../lib/influencer/types.ts";
import { rankCreators, dedupeCreators } from "../lib/influencer/rank.ts";

const NOW = "2026-08-29";
function creator(id: string, over: Partial<NormalizedCreator> = {}, audience?: Partial<AudienceEstimate>): NormalizedCreator {
  const aud: AudienceEstimate = { topCountries: [], genderLean: null, topLanguages: [], basis: "none", sampleSize: 0, source: "UNKNOWN", confidence: "none", note: "", ...audience };
  return {
    identity: { platform: "instagram", platformUserId: id, handle: "h" + id, profileUrl: "" },
    name: evidence("Creator " + id, "PROVIDER", "high", NOW),
    bio: evidence("women ethnic wear kurta saree festive styling", "PUBLIC_WEB", "medium", NOW),
    followers: evidence(100_000, "PROVIDER", "high", NOW),
    following: evidence(700, "PROVIDER", "high", NOW),
    postsCount: evidence(300, "PROVIDER", "medium", NOW),
    verified: evidence(true, "PROVIDER", "high", NOW),
    accountType: evidence("creator", "PROVIDER", "medium", NOW),
    creatorCountry: evidence("IN", "PROVIDER", "medium", NOW),
    creatorLanguage: evidence("hi", "PROVIDER", "low", NOW),
    avgLikes: evidence(3500, "CALCULATED", "medium", NOW),
    avgComments: evidence(90, "CALCULATED", "medium", NOW),
    avgViews: unknown(),
    engagementRate: evidence(0.035, "CALCULATED", "medium", NOW),
    engagementMethod: "(likes+comments)/followers",
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

// --- RANK IS QUALITY, NOT REACH. A relevant nano must outrank a huge off-category creator. ---
const relevantNano = creator("nano", { followers: evidence(7_000, "PROVIDER", "high", NOW) },
  { topCountries: [{ countryCode: "IN", share: 0.8 }], topLanguages: [{ language: "hi", share: 0.7 }], genderLean: { female: 0.75, male: 0.25 }, basis: "commenter-sample", sampleSize: 60, source: "INFERENCE", confidence: "medium", note: "n=60" });
const hugeIrrelevant = creator("mega", { followers: evidence(4_000_000, "PROVIDER", "high", NOW), bio: evidence("crypto stocks trading finance", "PUBLIC_WEB", "medium", NOW), creatorCountry: evidence("US", "PROVIDER", "medium", NOW) });
const ranked = rankCreators([hugeIrrelevant, relevantNano], target);
assert.equal(ranked.length, 2);
assert.equal(ranked[0].creator.identity.platformUserId, "nano", "the relevant nano ranks #1 over the 4M-follower off-category creator");
assert.equal(ranked[0].rank, 1);
assert.equal(ranked[1].rank, 2);
assert.ok(ranked[0].topReason.length > 0, "every ranked row carries a one-line why");

// --- DETERMINISTIC: same input -> same order (no Math.random, no follower tiebreak bias). ---
const twice = rankCreators([relevantNano, hugeIrrelevant], target).map((r) => r.creator.identity.platformUserId);
assert.deepEqual(twice, ["nano", "mega"], "order is input-independent and deterministic");

// --- DEDUP: two views of one creator merge to the BEST evidence, and rank once. ---
const thin = creator("dup", { followers: unknown(), engagementRate: evidence(0.02, "INFERENCE", "low", NOW) });
const rich = creator("dup", { followers: evidence(55_000, "PROVIDER", "high", NOW), engagementRate: evidence(0.04, "CALCULATED", "high", NOW) });
const merged = dedupeCreators([thin, rich]);
assert.equal(merged.length, 1, "same platform user id collapses to one row");
assert.equal(merged[0].followers.value, 55_000, "merge keeps the higher-confidence follower count");
assert.equal(merged[0].engagementRate.value, 0.04, "merge keeps the higher-confidence engagement rate");
assert.equal(rankCreators([thin, rich], target).length, 1, "a duplicate never appears twice in the ranking");

// --- HARD GATE: a spec floor/ceiling rejects out-of-band creators before scoring. ---
const spec: CreatorSearchSpec = { platform: "instagram", keywords: [], minFollowers: 50_000, maxFollowers: 500_000, minEngagementRate: 0.03, creatorCountry: "IN", creatorGender: null, audienceCountry: null, languages: [], tier: null };
const gated = rankCreators([relevantNano, creator("inband", { followers: evidence(120_000, "PROVIDER", "high", NOW) })], target, { spec });
assert.equal(gated.length, 1, "the 7k nano is below the 50k floor -> gated out");
assert.equal(gated[0].creator.identity.platformUserId, "inband");

// --- MISSING DATA NEVER REJECTS: unknown followers passes the follower gate (not punished as a failure). ---
const noFollowers = creator("nofoll", { followers: unknown() });
const gated2 = rankCreators([noFollowers], target, { spec });
assert.equal(gated2.length, 1, "unknown followers is not treated as failing the follower floor");

console.log("PASS: influencer ranking (quality over reach, deterministic, dedup, hard gates, missing != reject)");
