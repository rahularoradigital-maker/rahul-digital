// The provider abstraction: Influencer Hunt never hard-codes one data source. Every adapter (ScrapeCreators,
// Meta, Modash/HypeAuditor later, Apify) implements CreatorDataProvider and returns the same NormalizedCreator,
// so a provider can be swapped without touching the pipeline. Capabilities declare what a provider can
// actually do (e.g. ScrapeCreators: discover + profile, but audience UNSUPPORTED), so the pipeline escalates
// the ladder (official -> cheap -> specialist) only when needed. See docs/plans/influencer-hunt.md Phase 0.2.

import type { CreatorSearchSpec, CreatorIdentity, NormalizedCreator, EngagerSignal } from "./types";

export type ProviderCapability = "discover" | "profile" | "engagers" | "audience";

export interface CreatorDataProvider {
  readonly name: string;
  /** What this provider can do. The pipeline reads this to route work to the cheapest capable adapter. */
  readonly capabilities: ReadonlySet<ProviderCapability>;
  /** Broad, cheap discovery: keywords/spec -> candidate identities. Throws on hard failure; [] on none. */
  discover(spec: CreatorSearchSpec, limit: number): Promise<CreatorIdentity[]>;
  /** Public profile + engagement for one creator. Missing fields come back as UNKNOWN evidence, never faked. */
  profile(identity: CreatorIdentity): Promise<NormalizedCreator>;
  /** A sample of public engagers (commenters) for the Path A audience estimate. [] when unsupported/empty. */
  engagers(identity: CreatorIdentity, sample: number): Promise<EngagerSignal[]>;
  /** Optional: recent post captions gathered as a side effect of discovery (keyed by canonicalKey), so the
   * scorers can judge content/brand relevance from a creator's ACTUAL posts, not just their bio. A creator
   * found under a brand hashtag is relevant even when the bio never repeats the category words. */
  postContext?(): Map<string, string[]>;
}

/** Does this provider support a capability? (Keeps routing in one place.) */
export function can(provider: CreatorDataProvider, cap: ProviderCapability): boolean {
  return provider.capabilities.has(cap);
}
