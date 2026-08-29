// Ranking orchestrator: turn a raw, possibly-duplicated list of creators (from any provider) into a
// deduped, hard-filtered, TRANSPARENTLY RANKED shortlist. This is the formula-driven ranking the app
// promises (APP-CANON: ranking is a formula, never gut feel or an AI's opinion) - the order here is a
// pure function of the quality composite, and every row carries the scorecard that produced its place.
// Pure + provider-independent: providers fetch creators, this ranks them. No fabrication, no I/O.

import type { NormalizedCreator, BrandTarget, CreatorSearchSpec, Confidence } from "./types.ts";
import { canonicalKey, pickBetter } from "./dedup.ts";
import { tierOf } from "./tiers.ts";
import { scoreCreator, DEFAULT_QUALITY_WEIGHTS, type QualityWeights, type CreatorScorecard } from "./scoring/quality.ts";

export type RankedCreator = {
  rank: number; // 1-based
  creator: NormalizedCreator;
  scorecard: CreatorScorecard;
  topReason: string; // the single strongest component - the one-line "why this creator"
};

const CONF_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1, none: 0 };

// Merge two views of THE SAME creator (same canonical id) into one, keeping the best evidence per field.
// ponytail: field-by-field pickBetter is verbose but correct - a blanket "take the newer object" would
// silently drop a high-confidence follower count in favor of a low-confidence one from a fresher-but-thinner
// provider. Audience is not Evidence-wrapped, so it merges on its own confidence, then sample size.
function mergeCreators(a: NormalizedCreator, b: NormalizedCreator): NormalizedCreator {
  const audienceBetter =
    CONF_RANK[b.audience.confidence] > CONF_RANK[a.audience.confidence] ||
    (b.audience.confidence === a.audience.confidence && b.audience.sampleSize > a.audience.sampleSize);
  return {
    identity: a.identity, // same canonical id by construction; keep the first's handle/url
    name: pickBetter(a.name, b.name),
    bio: pickBetter(a.bio, b.bio),
    followers: pickBetter(a.followers, b.followers),
    following: pickBetter(a.following, b.following),
    postsCount: pickBetter(a.postsCount, b.postsCount),
    verified: pickBetter(a.verified, b.verified),
    accountType: pickBetter(a.accountType, b.accountType),
    creatorCountry: pickBetter(a.creatorCountry, b.creatorCountry),
    creatorLanguage: pickBetter(a.creatorLanguage, b.creatorLanguage),
    avgLikes: pickBetter(a.avgLikes, b.avgLikes),
    avgComments: pickBetter(a.avgComments, b.avgComments),
    avgViews: pickBetter(a.avgViews, b.avgViews),
    engagementRate: pickBetter(a.engagementRate, b.engagementRate),
    engagementMethod: a.engagementMethod || b.engagementMethod,
    businessEmail: pickBetter(a.businessEmail, b.businessEmail),
    audience: audienceBetter ? b.audience : a.audience,
  };
}

/** Collapse duplicates (same platform + platform user id) into one best-evidence creator each. */
export function dedupeCreators(creators: NormalizedCreator[]): NormalizedCreator[] {
  const byKey = new Map<string, NormalizedCreator>();
  for (const c of creators) {
    const k = canonicalKey(c.identity);
    const prior = byKey.get(k);
    byKey.set(k, prior ? mergeCreators(prior, c) : c);
  }
  return [...byKey.values()];
}

// Hard spec gates. These are PASS/FAIL requirements the user set explicitly (a min follower floor is a
// requirement, not a preference), so they filter before scoring - never softened into the score, or a
// creator the user ruled out could still rank. Only gates we can evaluate WITHOUT a provider live here;
// audience-country etc. are soft (weighted by audienceFit), because a Path A audience read is an estimate,
// not a hard fact to reject on. A gate whose field is UNKNOWN does NOT reject (we don't punish missing data
// by pretending it failed) - it passes and the missing data shows up as low confidence downstream.
function passesSpec(c: NormalizedCreator, spec: CreatorSearchSpec): boolean {
  if (c.identity.platform !== spec.platform) return false;
  const f = c.followers.value;
  if (f !== null) {
    if (spec.minFollowers !== null && f < spec.minFollowers) return false;
    if (spec.maxFollowers !== null && f > spec.maxFollowers) return false;
    if (spec.tier !== null && tierOf(f) !== spec.tier) return false;
  }
  const er = c.engagementRate.value;
  if (spec.minEngagementRate !== null && er !== null && er < spec.minEngagementRate) return false;
  if (spec.creatorCountry && c.creatorCountry.value && c.creatorCountry.value !== spec.creatorCountry) return false;
  return true;
}

/** The one-line "why" = the highest-scoring weighted component of the composite. */
function topReasonOf(card: CreatorScorecard): string {
  const best = card.quality.components
    .filter((x) => x.weight > 0)
    .reduce((a, b) => (b.score * b.weight > a.score * a.weight ? b : a));
  return best.reason;
}

export type RankOptions = { spec?: CreatorSearchSpec; weights?: QualityWeights; recentPostText?: Map<string, string[]> };

/**
 * Dedupe -> hard-gate (if a spec is given) -> score -> rank. Deterministic and formula-driven: the order is
 * purely quality.score, tie-broken by confidence then engagement then canonical id (NOT follower count - the
 * app must never let reach dominate relevance). Returns every survivor ranked, each with its full scorecard.
 */
export function rankCreators(creators: NormalizedCreator[], target: BrandTarget, opts: RankOptions = {}): RankedCreator[] {
  const weights = opts.weights ?? DEFAULT_QUALITY_WEIGHTS;
  const deduped = dedupeCreators(creators);
  const eligible = opts.spec ? deduped.filter((c) => passesSpec(c, opts.spec!)) : deduped;

  const scored = eligible.map((creator) => {
    const posts = opts.recentPostText?.get(canonicalKey(creator.identity));
    return { creator, scorecard: scoreCreator(creator, target, weights, posts) };
  });

  scored.sort((a, b) => {
    const q = b.scorecard.quality.score - a.scorecard.quality.score;
    if (Math.abs(q) > 1e-9) return q;
    const conf = CONF_RANK[b.scorecard.quality.confidence] - CONF_RANK[a.scorecard.quality.confidence];
    if (conf !== 0) return conf;
    const eng = b.scorecard.engagement.score - a.scorecard.engagement.score;
    if (Math.abs(eng) > 1e-9) return eng;
    return canonicalKey(a.creator.identity).localeCompare(canonicalKey(b.creator.identity));
  });

  return scored.map((s, i) => ({ rank: i + 1, creator: s.creator, scorecard: s.scorecard, topReason: topReasonOf(s.scorecard) }));
}
