// CANONICAL production creative fingerprint (ISSUE 18). This is the deterministic layer that the LIVE
// path uses: lib/meta-sync.ts + lib/creative/diversity.ts (the diversity the app renders) run on THIS.
// Given a normalized creative asset (pulled from Meta), it derives a stable content identity (content
// hash) and the facts you can know for free WITHOUT any model call: format, whether it carries video,
// copy length, CTA. This is the "fingerprint-once" key: creatives are stable day to day, so the
// expensive Gemini semantic read (hook/angle/persona/visual DNA) is cached against this hash and only
// recomputed when the creative actually changes.
//
// NOTE the sibling lib/fingerprint.ts is a DIFFERENT, not-yet-wired concept (a future spec-05 SEMANTIC
// similarity layer, exercised only by its own check). The two are not competing implementations of one
// thing: this file is deterministic facts in production; that one is semantic similarity for later. If
// the semantic layer is ever productionized it plugs in behind lib/creative/diversity.ts, it does not
// replace this fingerprint.
//
// Pure, no I/O, no deps, no fabrication. Every field traces to an input Meta returned.

// Normalized creative asset. The Meta pull maps object_story_spec / asset_feed_spec /
// call_to_action_type into this shape so the fingerprint never sees raw Graph JSON.
export type CreativeAsset = {
  adId: string;
  creativeId: string | null;
  imageUrl: string | null;
  videoThumbUrl: string | null;
  videoId: string | null;
  title: string | null; // headline
  body: string | null; // primary text
  ctaType: string | null; // call_to_action_type, e.g. SHOP_NOW
  isVideo: boolean;
  isCarousel: boolean;
  isCatalog: boolean; // Meta catalog / dynamic product ad (creative carries a product_set_id)
  assetCount: number; // # of cards/images (1 for a single image/video)
};

export type CreativeFormat = "video" | "carousel" | "image" | "catalog" | "unknown";

export type DeterministicFingerprint = {
  contentHash: string; // stable identity for fingerprint-once caching
  format: CreativeFormat;
  hasVideo: boolean;
  hasCopy: boolean;
  headlineLength: number;
  bodyLength: number;
  hasCta: boolean;
  ctaType: string | null;
  assetCount: number;
  label: "INTERNAL CALCULATION";
};

// FNV-1a 32-bit, rendered as 8 hex chars. Deterministic, dependency-free, and stable
// across runs/machines (unlike Object hashing or JSON key order), so the same creative
// always maps to the same cache key. Not cryptographic - it is an identity key, not a
// security primitive.
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // h *= 16777619, kept in 32-bit range via Math.imul to avoid float precision loss.
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// The identity of a creative = what a viewer actually sees: its media, its copy, its CTA
// and its format. Two ads pointing at the same asset + copy share a fingerprint (and one
// cached semantic read). URL query strings on media are stripped so a re-signed CDN URL
// for the same asset does not look like a new creative.
function stripQuery(url: string | null): string {
  if (!url) return "";
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

export function contentHash(asset: CreativeAsset): string {
  const media = asset.videoId ? `v:${asset.videoId}` : `i:${stripQuery(asset.imageUrl) || stripQuery(asset.videoThumbUrl)}`;
  const parts = [
    media,
    `t:${(asset.title ?? "").trim()}`,
    `b:${(asset.body ?? "").trim()}`,
    `c:${asset.ctaType ?? ""}`,
    `f:${formatOf(asset)}`,
    `n:${asset.assetCount}`,
  ];
  return fnv1a(parts.join("|"));
}

function formatOf(asset: CreativeAsset): CreativeFormat {
  // Catalog first: a dynamic product ad has no fixed media (it pulls from a product set), so it
  // would otherwise fall through to "unknown". product_set_id is Meta's authoritative catalog marker.
  if (asset.isCatalog) return "catalog";
  if (asset.isCarousel || asset.assetCount > 1) return "carousel";
  if (asset.isVideo || asset.videoId) return "video";
  if (asset.imageUrl) return "image";
  return "unknown";
}

// Drop catalog (dynamic product) ads from an analyzed set, for the topbar "exclude catalog"
// objective filter. An ad with NO creative asset this run is not known to be catalog, so it stays
// (never guess an ad away). Pure: the caller supplies the asset lookup, so this is trivially testable.
export function excludeCatalogAds<T>(items: T[], assetOf: (item: T) => CreativeAsset | undefined): T[] {
  return items.filter((item) => {
    const asset = assetOf(item);
    return !asset || deterministicFingerprint(asset).format !== "catalog";
  });
}

export function deterministicFingerprint(asset: CreativeAsset): DeterministicFingerprint {
  const headline = (asset.title ?? "").trim();
  const body = (asset.body ?? "").trim();
  return {
    contentHash: contentHash(asset),
    format: formatOf(asset),
    hasVideo: asset.isVideo || asset.videoId !== null,
    hasCopy: headline.length > 0 || body.length > 0,
    headlineLength: headline.length,
    bodyLength: body.length,
    hasCta: (asset.ctaType ?? "").trim().length > 0,
    ctaType: asset.ctaType && asset.ctaType.trim().length > 0 ? asset.ctaType.trim() : null,
    assetCount: Math.max(1, asset.assetCount),
    label: "INTERNAL CALCULATION",
  };
}
