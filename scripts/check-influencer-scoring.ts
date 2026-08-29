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
assert.ok(risk(creator()).components.some((c) => c.key === "fake_followers" && c.confidence === "none"), "fake-follower % is UNKNOWN, never fabricated");

// Quality composite: fully decomposed + confidence = weakest usable sub-score.
const card = scoreCreator(goodAud, target);
assert.ok(card.quality.components.length === 5, "quality decomposes into 5 sub-scores");
assert.ok(card.quality.score >= 0 && card.quality.score <= 100);
assert.ok(["low", "medium"].includes(card.quality.confidence), "composite confidence tracks the weakest usable input, capped by the proxy");

console.log("PASS: influencer scoring (brand-fit is relevance not reach, honest confidence, no fabrication)");
