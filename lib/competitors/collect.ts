import "server-only";
import type { NormalizedAd } from "./types.ts";
import { fetchBrandAds } from "../scrapecreators.ts";
import { fetchAdLibraryAds } from "../meta-source.ts";
import type { TokenSet } from "../ad-source.ts";

// Layer 2 (data collection) - SOURCE-INDEPENDENT. The pipeline is fundamentally live regardless of which
// source is configured: it prefers ScrapeCreators (the architecture's named source), falls back to the Meta
// Ad Library on the user's own token, and otherwise reports "none" honestly (it never fabricates competitor
// ads). Adding SCRAPECREATORS_API_KEY, or connecting Meta Ad Library access, lights it up with NO code change.

export type CollectSource = "scrapecreators" | "meta_ad_library" | "none";

// Which source is available right now. ScrapeCreators (a page-based, country-agnostic API key) is primary;
// the Meta Ad Library (the user's OAuth token) is the fallback.
export function availableSource(hasMetaToken: boolean): CollectSource {
  if (process.env.SCRAPECREATORS_API_KEY) return "scrapecreators";
  if (hasMetaToken) return "meta_ad_library";
  return "none";
}

// Fetch one brand/page's Ad Library ads via the chosen source, normalized to the shared NormalizedAd shape
// (identical downstream regardless of source). Returns [] for "none" - the caller renders a "connect a
// source" state, never invented data.
export async function collectBrandAds(
  source: CollectSource,
  pageId: string,
  label: string,
  isMyBrand: boolean,
  opts: { token?: TokenSet; country?: string } = {},
): Promise<NormalizedAd[]> {
  if (source === "scrapecreators") return fetchBrandAds(pageId, label, isMyBrand);
  // Meta Ad Library (ads_archive) filters by reached-country; default to US when the caller has no better
  // signal. ponytail: primary source (ScrapeCreators) is country-agnostic, so this default only affects the
  // fallback path - thread the account's real market here when it becomes available.
  if (source === "meta_ad_library" && opts.token) return fetchAdLibraryAds(pageId, label, isMyBrand, opts.country ?? "US", opts.token);
  return [];
}
