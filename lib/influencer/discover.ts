// Discovery orchestration: brand target -> search -> progressive enrichment -> dedupe -> formula rank.
// PURE given a CreatorDataProvider (the provider does all I/O), so the whole flow is testable with a fake
// provider and works identically for ScrapeCreators today or Modash tomorrow. Cost-aware: we only fetch full
// profiles for the bounded candidate set, and one creator's fetch failing never sinks the run.

import type { CreatorDataProvider } from "./provider.ts";
import type { BrandTarget, NormalizedCreator } from "./types.ts";
import { creatorSearchSpecFrom, discoveryHashtags } from "./spec.ts";
import { rankCreators, type RankedCreator } from "./rank.ts";
import { canonicalKey } from "./dedup.ts";
import { looksLikeBrand } from "./derive.ts";

// Sized to stay safely under the ~60s serverless cap AND under provider rate limits. The pool still beats the
// old single-tier (~11) because the cheap Tier-1 pass drops brands/floor BEFORE any reels credit is spent, so
// the reels budget covers real survivors instead of being wasted on brands. Total calls ~= ENRICH + REELS_MAX.
const DEFAULT_ENRICH = 36; // Tier-1 candidate pool (profile-only, cheap)
const REELS_MAX = 18; // Tier-2: reels fetched only for this many SURVIVORS (after brands/floor are dropped)
const DEFAULT_CONCURRENCY = 10; // parallel fetches: fast but gentle on the provider's rate limit
const DEFAULT_MIN_FOLLOWERS = 10_000; // influencer floor: drop tiny shops/resellers. Adjustable per run.
// Plausible engagement band. Below the floor = dead/bought-follower BRAND pages (a real creator engages its
// audience); above the ceiling = bought-engagement. Both are dropped so only real creators remain. A creator
// with UNKNOWN engagement is kept (unknown != dead - never guessed).
const DEFAULT_MIN_ENGAGEMENT = 0.005; // 0.5%
const DEFAULT_MAX_ENGAGEMENT = 0.2; //   20% - above this at a 10K+ account is almost always bought engagement

export type DiscoverStats = { queries: string[]; candidates: number; enriched: number; failed: number };
export type DiscoverResult = { ranked: RankedCreator[]; stats: DiscoverStats };

// Bounded-concurrency map: run `fn` over items at most `n` at a time. Keeps us well under provider rate limits
// and avoids opening 18 sockets at once, without pulling in a dependency.
async function mapPool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Find and rank creators for a brand using the given provider. Throws only on a hard discovery failure
 * (e.g. provider out of credits / bad key) so the caller can report it honestly; a per-creator profile
 * failure is swallowed (that creator is dropped, the run continues).
 */
export async function discoverAndRank(
  provider: CreatorDataProvider,
  target: BrandTarget,
  accountName: string | null,
  opts: { enrich?: number; concurrency?: number; minFollowers?: number; minEngagement?: number; maxEngagement?: number } = {},
): Promise<DiscoverResult> {
  const enrich = opts.enrich ?? DEFAULT_ENRICH;
  const floor = opts.minFollowers ?? DEFAULT_MIN_FOLLOWERS;
  const minEng = opts.minEngagement ?? DEFAULT_MIN_ENGAGEMENT;
  const maxEng = opts.maxEngagement ?? DEFAULT_MAX_ENGAGEMENT;
  // Discover creators from the brand's hashtags (authors of relevant posts), not shops named after the
  // category. The provider treats these keywords as hashtags, and honors the follower floor where the
  // hashtag record carries a follower count.
  const queries = discoveryHashtags(target, accountName);
  const spec = { ...creatorSearchSpecFrom(target), keywords: queries, minFollowers: floor };

  // Discover a big candidate pool (bounded to `enrich`).
  const discovered = await provider.discover(spec, enrich);
  // Dedupe candidates by canonical id BEFORE enriching, so a provider that returns the same creator twice
  // never costs us two profile credits for one person.
  const byKey = new Map<string, (typeof discovered)[number]>();
  for (const id of discovered) if (!byKey.has(canonicalKey(id))) byKey.set(canonicalKey(id), id);
  const identities = [...byKey.values()];
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;

  // The test for a REAL creator to keep (applied once we know followers/bio/engagement): above the follower
  // floor, not a brand/shop, and not a dead/bought page. Unknowns are kept (never guessed as a fail).
  const keep = (c: NormalizedCreator) =>
    (c.followers.value == null || c.followers.value >= floor) &&
    !looksLikeBrand(c.name.value, c.bio.value) &&
    (c.engagementRate.value == null || (c.engagementRate.value >= minEng && c.engagementRate.value <= maxEng));

  let failed = 0;
  let creators: NormalizedCreator[];
  if (typeof provider.profileBasic === "function" && typeof provider.attachReels === "function") {
    // TWO-TIER: cheap profile-only for the whole pool, drop brands/floor/dead, THEN reels for survivors only -
    // so a much bigger pool of real creators survives without blowing the reels-credit / time budget.
    const basics = (
      await mapPool(identities, concurrency, async (id) => {
        try { return await provider.profileBasic!(id); } catch { failed++; return null; }
      })
    ).filter((c): c is NormalizedCreator => c !== null).filter(keep);
    const forReels = basics.slice(0, REELS_MAX);
    creators = await mapPool(forReels, concurrency, async (c) => {
      try { return await provider.attachReels!(c); } catch { return c; } // keep without reels on failure
    });
  } else {
    // Single-tier fallback (fake providers / simple adapters): profile() fetches everything at once.
    const enriched = await mapPool(identities, concurrency, async (id) => {
      try { return await provider.profile(id); } catch { failed++; return null; }
    });
    creators = enriched.filter((c): c is NormalizedCreator => c !== null).filter(keep);
  }

  // rankCreators dedupes (same platform user id) and orders purely by the quality formula. Feed the post
  // captions gathered during discovery so content/brand fit judge real posts, not just the bio.
  const ranked = rankCreators(creators, target, { recentPostText: provider.postContext?.() });
  return { ranked, stats: { queries, candidates: identities.length, enriched: creators.length, failed } };
}
