// Discovery orchestration: brand target -> search -> progressive enrichment -> dedupe -> formula rank.
// PURE given a CreatorDataProvider (the provider does all I/O), so the whole flow is testable with a fake
// provider and works identically for ScrapeCreators today or Modash tomorrow. Cost-aware: we only fetch full
// profiles for the bounded candidate set, and one creator's fetch failing never sinks the run.

import type { CreatorDataProvider } from "./provider.ts";
import type { BrandTarget, NormalizedCreator } from "./types.ts";
import { creatorSearchSpecFrom, discoveryHashtags } from "./spec.ts";
import { rankCreators, type RankedCreator } from "./rank.ts";
import { canonicalKey } from "./dedup.ts";

const DEFAULT_ENRICH = 24; // profiles fetched per run (= credits); affordable now that hashtags fetch in parallel
const DEFAULT_CONCURRENCY = 8; // parallel profile fetches: keeps the whole run fast (well under the ~60s serverless cap)
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

  // Cheap, broad discovery first. Bounded to `enrich` so we never fetch a profile we won't use.
  const discovered = await provider.discover(spec, enrich);
  // Dedupe candidates by canonical id BEFORE enriching, so a provider that returns the same creator twice
  // never costs us two profile credits for one person.
  const byKey = new Map<string, (typeof discovered)[number]>();
  for (const id of discovered) if (!byKey.has(canonicalKey(id))) byKey.set(canonicalKey(id), id);
  const identities = [...byKey.values()];

  // Progressive enrichment: full profile only for the candidate set. Failures isolate to that creator.
  let failed = 0;
  const enriched = await mapPool(identities, opts.concurrency ?? DEFAULT_CONCURRENCY, async (id) => {
    try {
      return await provider.profile(id);
    } catch {
      failed++;
      return null;
    }
  });
  // Re-apply the follower floor AFTER enrichment: some hashtag records carry no follower_count, so a tiny
  // shop can slip past the discovery-stage floor. Now that we have real follower counts, drop anyone below
  // the floor so a 2K reseller can never rank above real creators. (Unknown followers are kept, not guessed.)
  const creators = enriched
    .filter((c): c is NormalizedCreator => c !== null)
    .filter((c) => c.followers.value == null || c.followers.value >= floor)
    // Drop dead/bought BRAND pages: known engagement outside the plausible band. Unknown engagement is kept.
    .filter((c) => {
      const er = c.engagementRate.value;
      return er == null || (er >= minEng && er <= maxEng);
    });

  // rankCreators dedupes (same platform user id) and orders purely by the quality formula. Feed the post
  // captions gathered during discovery so content/brand fit judge real posts, not just the bio.
  const ranked = rankCreators(creators, target, { recentPostText: provider.postContext?.() });
  return { ranked, stats: { queries, candidates: identities.length, enriched: creators.length, failed } };
}
