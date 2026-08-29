// One runnable check for the Influencer Hunt foundation. No frameworks. Enforces the honesty invariants:
// the Path A audience proxy never fabricates, confidence is capped, dedup keeps the best evidence, tiers are
// config-driven. Run: node --experimental-strip-types scripts/check-influencer-hunt.ts
import assert from "node:assert/strict";
import { unknown, evidence, type EngagerSignal } from "../lib/influencer/types.ts";
import { estimateAudience } from "../lib/influencer/audience-proxy.ts";
import { tierOf, tierRange, DEFAULT_TIER_BANDS } from "../lib/influencer/tiers.ts";
import { canonicalKey, pickBetter } from "../lib/influencer/dedup.ts";

// --- Evidence envelope: UNKNOWN is null, known carries a value. Never a fabricated 0. ---
assert.equal(unknown<number>().value, null, "unknown() is null, never a fake 0");
assert.equal(unknown<number>().source, "UNKNOWN");
assert.equal(unknown<number>().confidence, "none");
const known = evidence(4200, "PROVIDER", "high", "2026-08-29");
assert.equal(known.value, 4200);
assert.equal(known.source, "PROVIDER");

// --- Path A: NO signal at all -> honest "none", never invented demographics. ---
const none = estimateAudience(null, null, []);
assert.equal(none.basis, "none");
assert.equal(none.source, "UNKNOWN");
assert.equal(none.confidence, "none");
assert.deepEqual(none.topCountries, [], "no signal -> no countries, never guessed");
assert.equal(none.genderLean, null, "no signal -> no gender guess");

// --- Path A: only the creator's own country -> weak "creator-only" proxy, LOW confidence, labeled. ---
const creatorOnly = estimateAudience("IN", "hi", []);
assert.equal(creatorOnly.basis, "creator-only");
assert.equal(creatorOnly.source, "INFERENCE");
assert.equal(creatorOnly.confidence, "low");
assert.deepEqual(creatorOnly.topCountries, [{ countryCode: "IN", share: 1 }]);
assert.ok(/not on follower data/i.test(creatorOnly.note), "creator-only estimate says it is NOT follower data");

// --- Path A: a commenter sample -> country/language shares, but confidence NEVER exceeds "medium". ---
const sample: EngagerSignal[] = [
  ...Array.from({ length: 30 }, () => ({ countryCode: "US", language: "en", genderGuess: "f" as const })),
  ...Array.from({ length: 20 }, () => ({ countryCode: "US", language: "en", genderGuess: "m" as const })),
  ...Array.from({ length: 10 }, () => ({ countryCode: "GB", language: "en", genderGuess: null })),
];
const est = estimateAudience("US", "en", sample);
assert.equal(est.basis, "commenter-sample");
assert.equal(est.source, "INFERENCE");
assert.equal(est.confidence, "medium", "60 signals -> medium, never high (a proxy is never 'high')");
assert.equal(est.topCountries[0].countryCode, "US");
assert.equal(est.topCountries[0].share, 0.83, "50/60 US");
assert.ok(est.genderLean && Math.abs(est.genderLean.female - 0.6) < 0.001, "gender lean = 30/50 female from confident guesses");

// --- Path A: too few confident gender guesses -> NO gender lean (never a 50/50 coin-flip). ---
const fewGender = estimateAudience("US", "en", Array.from({ length: 30 }, () => ({ countryCode: "US", language: "en", genderGuess: null })));
assert.equal(fewGender.genderLean, null, "no confident gender signals -> null, not 50/50");
assert.equal(fewGender.confidence, "low", "30 country-only signals is a thin sample -> low");

// --- Tiers: config-driven boundaries, mega above macro. ---
assert.equal(tierOf(5_000), "nano");
assert.equal(tierOf(50_000), "micro");
assert.equal(tierOf(300_000), "mid");
assert.equal(tierOf(800_000), "macro");
assert.equal(tierOf(5_000_000), "mega");
assert.equal(tierRange("mega", DEFAULT_TIER_BANDS).max, Infinity);
assert.equal(tierOf(50_000, { nano: 60_000, micro: 200_000, mid: 800_000, macro: 2_000_000 }), "nano", "custom bands: 50k is nano under a bigger-market config");

// --- Dedup: canonical key ignores handle; merge keeps the higher-confidence evidence. ---
assert.equal(
  canonicalKey({ platform: "instagram", platformUserId: "123", handle: "a", profileUrl: "" }),
  canonicalKey({ platform: "instagram", platformUserId: "123", handle: "a_renamed", profileUrl: "" }),
  "same platform user id = same creator even after a handle change",
);
const weak = evidence(1000, "INFERENCE", "low", "2026-08-01");
const strong = evidence(1200, "PROVIDER", "high", "2026-08-29");
assert.equal(pickBetter(weak, strong).value, 1200, "higher confidence wins the merge");
assert.equal(pickBetter(strong, weak).value, 1200, "order-independent");
assert.equal(pickBetter(unknown<number>(), strong).value, 1200, "a real value beats UNKNOWN");
assert.equal(pickBetter(unknown<number>(), unknown<number>()).value, null, "UNKNOWN + UNKNOWN stays UNKNOWN, never invented");

console.log("PASS: influencer hunt foundation (evidence honesty, Path A proxy, tiers, dedup)");
