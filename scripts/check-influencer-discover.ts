// Runnable check for the discovery orchestration, with a FAKE provider (no network). Proves: it searches the
// brand's queries, enriches candidates, ISOLATES a per-creator profile failure (drops that one, run survives),
// dedupes, ranks by the formula, and reports honest stats + a zero-result path.
// Run: node --experimental-strip-types scripts/check-influencer-discover.ts
import assert from "node:assert/strict";
import { unknown, evidence, type NormalizedCreator, type BrandTarget, type CreatorIdentity, type CreatorSearchSpec, type EngagerSignal } from "../lib/influencer/types.ts";
import type { CreatorDataProvider, ProviderCapability } from "../lib/influencer/provider.ts";
import { discoverAndRank } from "../lib/influencer/discover.ts";

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

console.log("PASS: influencer discovery (search->enrich->dedupe->rank, failure isolation, zero-result path)");
