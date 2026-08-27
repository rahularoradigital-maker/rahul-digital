// Stage 2 (data collection) + stage 3 (normalize) of the competitor pipeline. SERVER-ONLY:
// reads SCRAPECREATORS_API_KEY and calls the ScrapeCreators Facebook Ad Library API. Turns
// the raw Ad Library payload into NormalizedAd[]. No fabricated data: a field the API does
// not return is null, never invented.

import type { MediaCategory, NormalizedAd } from "./competitors/types.ts";

const COMPANY_ADS_URL = "https://api.scrapecreators.com/v1/facebook/adLibrary/company/ads";
const SEARCH_COMPANIES_URL = "https://api.scrapecreators.com/v1/facebook/adLibrary/search/companies";
const MAX_PAGES = 3; // ~90 ads/brand: enough to characterise a brand while bounding credits.
// ponytail: cursor pagination stops at MAX_PAGES; raise it (or a background job) if a brand
// needs its full history rather than a representative recent slice.

// Extract the Ad Library page id from a pasted URL. Accepts view_all_page_id=, id=, or a
// bare numeric id. Returns null when no id is present (caller reports a bad URL honestly).
export function pageIdFromAdLibraryUrl(url: string): string | null {
  const s = url.trim();
  const viewAll = s.match(/view_all_page_id=(\d+)/);
  if (viewAll) return viewAll[1];
  const id = s.match(/[?&]id=(\d+)/);
  if (id) return id[1];
  const bare = s.match(/^\d{5,}$/);
  return bare ? bare[0] : null;
}

export type CompanySuggestion = {
  pageId: string;
  name: string;
  category: string | null;
  imageUri: string | null;
  likes: number | null;
  verified: boolean; // the real brand page is almost always verified
};

// Search Meta brand pages by keyword (stage 1 assist: discover competitors instead of
// pasting Ad Library URLs by hand). The API returns candidates in relevance order, which for
// a common brand name surfaces namesakes and fan pages ahead of the real brand. The real
// brand page is the VERIFIED one with the most likes, so we re-rank on (verified, likes) and
// expose both signals to the UI - that is how the correct page gets picked, not a namesake.
// Drops deleted pages; caps the list. Throws only on a missing key.
export async function searchCompanies(query: string, limit = 10): Promise<CompanySuggestion[]> {
  const key = process.env.SCRAPECREATORS_API_KEY;
  if (!key) throw new Error("SCRAPECREATORS_API_KEY is not set");
  const q = query.trim();
  if (!q) return [];
  const url = new URL(SEARCH_COMPANIES_URL);
  url.searchParams.set("query", q);
  const res = await fetch(url, { headers: { "x-api-key": key } });
  if (!res.ok) throw new Error(`ScrapeCreators search ${res.status}`);
  const json = (await res.json()) as { searchResults?: RawCompany[] };
  const results = Array.isArray(json.searchResults) ? json.searchResults : [];
  return results
    .filter((r) => r.page_id && !r.page_is_deleted)
    .map((r) => ({
      pageId: String(r.page_id),
      name: r.name ?? `Page ${r.page_id}`,
      category: r.category ?? null,
      imageUri: r.image_uri ?? null,
      likes: typeof r.likes === "number" ? r.likes : null,
      verified: Boolean(r.verification && r.verification !== "NOT_VERIFIED"),
    }))
    // Verified first, then most-liked: the real brand page rises to the top.
    .sort((a, b) => Number(b.verified) - Number(a.verified) || (b.likes ?? 0) - (a.likes ?? 0))
    .slice(0, limit);
}

type RawCompany = {
  page_id?: string | number;
  name?: string;
  category?: string;
  image_uri?: string;
  likes?: number;
  verification?: string;
  page_is_deleted?: boolean;
};

type RawAd = {
  ad_archive_id?: string;
  page_id?: string;
  page_name?: string;
  is_active?: boolean;
  publisher_platform?: string[];
  start_date?: number;
  end_date?: number;
  url?: string;
  snapshot?: {
    display_format?: string;
    cta_text?: string;
    cta_type?: string;
    title?: string;
    body?: string | { text?: string };
    link_url?: string;
    cards?: MediaBearing[];
    images?: MediaBearing[];
    videos?: MediaBearing[];
  };
};

// The subset of media fields the Ad Library exposes on images / videos / cards. Used to
// pick the best still image + video for the LLM to read (stage 7).
type MediaBearing = {
  original_image_url?: string;
  resized_image_url?: string;
  video_hd_url?: string;
  video_sd_url?: string;
  video_preview_image_url?: string;
};

// Best available image / video / video-thumbnail across the snapshot's images, videos, and
// carousel cards. Returns nulls when the creative carries no media of that kind (never a
// fabricated URL). Prefers original/HD over resized/SD.
function pickMedia(snap: NonNullable<RawAd["snapshot"]>): { imageUrl: string | null; videoUrl: string | null; videoThumbUrl: string | null } {
  const pools: MediaBearing[] = [
    ...(Array.isArray(snap.videos) ? snap.videos : []),
    ...(Array.isArray(snap.images) ? snap.images : []),
    ...(Array.isArray(snap.cards) ? snap.cards : []),
  ];
  let imageUrl: string | null = null;
  let videoUrl: string | null = null;
  let videoThumbUrl: string | null = null;
  for (const m of pools) {
    if (!videoUrl && (m.video_hd_url || m.video_sd_url)) videoUrl = m.video_hd_url ?? m.video_sd_url ?? null;
    if (!videoThumbUrl && m.video_preview_image_url) videoThumbUrl = m.video_preview_image_url;
    if (!imageUrl && (m.original_image_url || m.resized_image_url)) imageUrl = m.original_image_url ?? m.resized_image_url ?? null;
    if (videoUrl && imageUrl && videoThumbUrl) break;
  }
  return { imageUrl, videoUrl, videoThumbUrl };
}

// Normalize Meta's display_format (+ card count) into a coarse media bucket for the mix.
// A multi-card creative is a carousel regardless of the format label; then VIDEO / IMAGE;
// anything else (e.g. a single DCO/DPA slot) is "other" rather than a guessed category.
function mediaOf(displayFormat: string, cardCount: number): MediaCategory {
  if (cardCount > 1) return "carousel";
  const f = displayFormat.toUpperCase();
  if (f.includes("VIDEO")) return "video";
  if (f.includes("IMAGE") || f === "DPA") return "image";
  return "other";
}

function bodyText(body: string | { text?: string } | undefined): string | null {
  if (typeof body === "string") return body || null;
  return body?.text ?? null;
}

function normalize(raw: RawAd, brandLabel: string, isMyBrand: boolean): NormalizedAd | null {
  const pageId = raw.page_id;
  const adArchiveId = raw.ad_archive_id;
  if (!pageId || !adArchiveId) return null; // an ad we cannot key is dropped, not faked
  const snap = raw.snapshot ?? {};
  const cardCount = Array.isArray(snap.cards) ? snap.cards.length : 0;
  const displayFormat = snap.display_format ?? "";
  const media = pickMedia(snap);
  return {
    pageId,
    adArchiveId,
    brandLabel: raw.page_name || brandLabel,
    isMyBrand,
    isActive: raw.is_active ?? false,
    displayFormat,
    media: mediaOf(displayFormat, cardCount),
    ctaText: snap.cta_text ?? null,
    ctaType: snap.cta_type ?? null,
    title: snap.title ?? null,
    body: bodyText(snap.body),
    linkUrl: snap.link_url ?? null,
    platforms: Array.isArray(raw.publisher_platform) ? raw.publisher_platform : [],
    startDate: raw.start_date ?? null,
    endDate: raw.end_date ?? null,
    cardCount,
    adUrl: raw.url ?? `https://www.facebook.com/ads/library/?id=${adArchiveId}`,
    imageUrl: media.imageUrl,
    videoUrl: media.videoUrl,
    videoThumbUrl: media.videoThumbUrl,
  };
}

/**
 * Fetch and normalize a brand's live Ad Library ads. `label`/`isMyBrand` tag the rows so
 * the analytics layer can split my brand from competitors. Paginates up to MAX_PAGES.
 * Throws on a missing key or a non-OK response so the caller can report it honestly.
 */
export async function fetchBrandAds(
  pageId: string,
  label: string,
  isMyBrand: boolean,
  opts: { country?: string; status?: "ALL" | "ACTIVE" | "INACTIVE" } = {},
): Promise<NormalizedAd[]> {
  const key = process.env.SCRAPECREATORS_API_KEY;
  if (!key) throw new Error("SCRAPECREATORS_API_KEY is not set");

  const out: NormalizedAd[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(COMPANY_ADS_URL);
    url.searchParams.set("pageId", pageId);
    url.searchParams.set("status", opts.status ?? "ALL");
    url.searchParams.set("trim", "true");
    if (opts.country) url.searchParams.set("country", opts.country);
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url, { headers: { "x-api-key": key } });
    if (!res.ok) throw new Error(`ScrapeCreators ${res.status} for page ${pageId}`);
    const json = (await res.json()) as { results?: RawAd[]; cursor?: string };
    const results = Array.isArray(json.results) ? json.results : [];
    for (const raw of results) {
      const ad = normalize(raw, label, isMyBrand);
      if (ad) out.push(ad);
    }
    if (!json.cursor || results.length === 0) break;
    cursor = json.cursor;
  }
  return out;
}
