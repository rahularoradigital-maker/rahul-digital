// Runnable check for the discovery orchestration, with a FAKE provider (no network). Proves: it searches the
// brand's queries, enriches candidates, ISOLATES a per-creator profile failure (drops that one, run survives),
// dedupes, ranks by the formula, and reports honest stats + a zero-result path.
// Run: node --experimental-strip-types scripts/check-influencer-discover.ts
import assert from "node:assert/strict";
import { unknown, evidence, type NormalizedCreator, type BrandTarget, type CreatorIdentity, type CreatorSearchSpec, type EngagerSignal } from "../lib/influencer/types.ts";
import type { CreatorDataProvider, ProviderCapability } from "../lib/influencer/provider.ts";
import { discoverAndRank } from "../lib/influencer/discover.ts";
import { bandOf, inBand } from "../lib/influencer/bands.ts";
import { looksLikeBrand } from "../lib/influencer/derive.ts";

const NOW = "2026-08-29";
function creator(id: string, handle: string, followers: number, er: number, bio: string): NormalizedCreator {
  return {
    identity: { platform: "instagram", platformUserId: id, handle, profileUrl: `https://instagram.com/${handle}` },
    name: evidence(handle, "PROVIDER", "high", NOW),
    bio: evidence(bio, "PUBLIC_WEB", "medium", NOW),
    followers: evidence(followers, "PROVIDER", "high", NOW),
    following: evidence(500, "PROVIDER", "high", NOW),
    postsCount: evidence(300, "PROVIDER", "medium", NOW),
    verified: evidence(false, "PROVIDER", "high", NOW),
    accountType: evidence("creator", "PROVIDER", "medium", NOW),
    creatorCountry: unknown(), creatorLanguage: unknown(),
    avgLikes: evidence(Math.round(followers * er), "PROVIDER", "medium", NOW),
    avgComments: evidence(Math.round(followers * er * 0.03), "PROVIDER", "medium", NOW),
    avgViews: unknown(),
    engagementRate: evidence(er, "CALCULATED", "medium", NOW),
    engagementMethod: "(likes+comments)/followers",
    businessEmail: unknown(),
    audience: { topCountries: [], genderLean: null, topLanguages: [], basis: "none", sampleSize: 0, source: "UNKNOWN", confidence: "none", note: "" },
  };
}

const target: BrandTarget = {
  category: "women's ethnic wear", keyProducts: ["kurta", "saree"], targetCountry: "IN", languages: ["hi", "en"],
  personaGender: "f", tone: "festive", requiredFormats: ["video", "ugc"], contentKeywords: ["kurta", "saree", "ethnic", "festive"], competitors: [],
};

// Fake provider: search returns 4 identities (incl. a DUPLICATE id to prove dedup); one handle's profile throws.
let searchCalls = 0;
const fake: CreatorDataProvider = {
  name: "fake",
  capabilities: new Set<ProviderCapability>(["discover", "profile"]),
  async discover(spec: CreatorSearchSpec, limit: number): Promise<CreatorIdentity[]> {
    searchCalls = spec.keywords.length;
    const ids: CreatorIdentity[] = [
      { platform: "instagram", platformUserId: "a", handle: "ethnic_a", profileUrl: "" },
      { platform: "instagram", platformUserId: "b", handle: "boom_b", profileUrl: "" },
      { platform: "instagram", platformUserId: "c", handle: "saree_c", profileUrl: "" },
      { platform: "instagram", platformUserId: "a", handle: "ethnic_a_dup", profileUrl: "" }, // same id as a
    ];
    return ids.slice(0, limit);
  },
  async profile(id: CreatorIdentity): Promise<NormalizedCreator> {
    if (id.handle === "boom_b") throw new Error("profile fetch failed"); // isolate this failure
    if (id.platformUserId === "a") return creator("a", "ethnic_a", 40_000, 0.05, "women ethnic wear kurta saree festive styling");
    return creator("c", "saree_c", 12_000, 0.06, "saree draping festive looks");
  },
  async engagers(_id: CreatorIdentity, _n: number): Promise<EngagerSignal[]> { return []; },
};

const { ranked, stats } = await discoverAndRank(fake, target, "Soch", { enrich: 10, concurrency: 3 });

// Searched the brand's queries (category + products), enriched, isolated the failure, deduped.
assert.ok(searchCalls >= 2, "discovery searched multiple brand-derived queries");
assert.equal(stats.failed, 1, "the throwing profile is counted as failed, not fatal");
assert.equal(stats.enriched, 2, "two creators enriched (boom_b dropped)");
assert.equal(ranked.length, 2, "duplicate id 'a' collapsed; failed 'b' dropped -> 2 ranked");
assert.deepEqual([...new Set(ranked.map((r) => r.creator.identity.platformUserId))].sort(), ["a", "c"], "exactly the two real, deduped creators");
assert.equal(ranked[0].rank, 1);
assert.ok(ranked.every((r) => r.topReason.length > 0), "every ranked creator has a why");
assert.ok(ranked.every((r) => r.scorecard.quality.score >= 0 && r.scorecard.quality.score <= 100));

// Zero-result path: provider finds nobody -> empty ranked, honest stats, no throw.
const empty = await discoverAndRank(
  { ...fake, async discover() { return []; } },
  target, "Soch", { enrich: 10 },
);
assert.equal(empty.ranked.length, 0, "no candidates -> empty ranking, not a crash");
assert.equal(empty.stats.enriched, 0);

// --- Follower floor is re-applied AFTER enrichment: a tiny shop that slipped past discovery (no follower
// count in its hashtag record) is dropped once we learn its real, sub-floor follower count. ---
const tinyProvider: CreatorDataProvider = {
  ...fake,
  async discover() { return [{ platform: "instagram", platformUserId: "tiny", handle: "tiny_shop", profileUrl: "" }]; },
  async profile() { return creator("tiny", "tiny_shop", 3_000, 0.05, "women ethnic wear kurta saree festive"); },
};
assert.equal((await discoverAndRank(tinyProvider, target, "Soch", { enrich: 5 })).ranked.length, 0, "a 3K account is dropped by the default 10K follower floor");
assert.equal((await discoverAndRank(tinyProvider, target, "Soch", { enrich: 5, minFollowers: 1_000 })).ranked.length, 1, "a lower explicit floor keeps the 3K account");

// --- Engagement band: dead/bought BRAND pages (near-0%) and bought-engagement (>35%) are dropped; a normal
// rate is kept; unknown engagement is kept (never guessed as dead). ---
const engProvider = (er: number | null): CreatorDataProvider => ({
  ...fake,
  async discover() { return [{ platform: "instagram", platformUserId: "e", handle: "e", profileUrl: "" }]; },
  async profile() {
    const c = creator("e", "e", 50_000, er ?? 0.03, "women ethnic wear kurta saree festive");
    if (er == null) return { ...c, engagementRate: unknown<number>() };
    return c;
  },
});
assert.equal((await discoverAndRank(engProvider(0.0001), target, "S", { enrich: 3 })).ranked.length, 0, "a ~0% (dead/bought) brand page is dropped");
assert.equal((await discoverAndRank(engProvider(0.6), target, "S", { enrich: 3 })).ranked.length, 0, "a 60% bought-engagement account is dropped");
assert.equal((await discoverAndRank(engProvider(0.25), target, "S", { enrich: 3 })).ranked.length, 0, "a 25% bought-engagement account is dropped (ceiling 20%)");
assert.equal((await discoverAndRank(engProvider(0.03), target, "S", { enrich: 3 })).ranked.length, 1, "a normal 3% engagement creator is kept");
assert.equal((await discoverAndRank(engProvider(null), target, "S", { enrich: 3 })).ranked.length, 1, "unknown engagement is kept, never treated as dead");

// --- Size bands: a creator only shows in its follower band; unknown followers show only under "All". ---
assert.equal(inBand(30_000, bandOf("10-50k")), true);
assert.equal(inBand(30_000, bandOf("50-500k")), false);
assert.equal(inBand(120_000, bandOf("50-500k")), true);
assert.equal(inBand(750_000, bandOf("500k+")), true);
assert.equal(inBand(null, bandOf("all")), true);
assert.equal(inBand(null, bandOf("50-500k")), false);

// --- BRANDS / shops (competitors) are excluded; real creators are kept. ---
assert.equal(looksLikeBrand("V.O.I.D", "Premium Designer Label Shipping worldwide"), true, "an apparel label is a brand");
assert.equal(looksLikeBrand("Rank1 Clothing", "resellers welcome, budget fashion"), true, "a clothing shop is a brand");
assert.equal(looksLikeBrand("Yamini Polnati", "fashion creator, dm for collab"), false, "a fashion creator is kept");
const brandProvider: CreatorDataProvider = {
  ...fake,
  async discover() { return [{ platform: "instagram", platformUserId: "brand", handle: "somelabel", profileUrl: "" }]; },
  async profile() { return creator("brand", "somelabel", 80_000, 0.04, "Premium designer label · shipping worldwide · dm to order"); },
};
assert.equal((await discoverAndRank(brandProvider, target, "S", { enrich: 3 })).ranked.length, 0, "a brand/shop account is dropped from the creator shortlist");

// --- "New influencers only": excludeIds drops already-seen creators BEFORE enrichment. ---
const exclRes = await discoverAndRank(fake, target, "S", { enrich: 10, excludeIds: new Set(["a"]) });
assert.ok(!exclRes.ranked.some((r) => r.creator.identity.platformUserId === "a"), "excludeIds drops an already-seen creator");

console.log("PASS: influencer discovery (search->enrich->dedupe->rank, failure isolation, zero-result path)");
