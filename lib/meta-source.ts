// Meta implementation of the AdSource interface (ADR-0002). Real Graph API calls
// (Marketing API v21) against a connected user's token. No Claude/MCP anywhere:
// this runs inside the deployed app with the END USER's own OAuth token.
// Pure data-fetching; scoring/verdicts happen in the rules engine, not here.

import type { AdSource, TokenSet, SourceAd, MetricsRow } from "./ad-source.ts";
import type { Objective } from "./rules/comparator.ts";
import type { CreativeAsset } from "./creative/fingerprint.ts";
import type { NormalizedAd } from "./competitors/types.ts";
import type { Candidate } from "./brand/discover.ts";

const GRAPH = "https://graph.facebook.com/v21.0";

type MetaAdAccount = { account_id: string; name?: string; business?: { id: string; name?: string } };
type MetaAd = { id: string; name?: string; effective_status?: string; creative?: { id?: string } };
type MetaInsightAction = { action_type: string; value: string };
type MetaInsightRow = {
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  frequency?: string;
  actions?: MetaInsightAction[];
  action_values?: MetaInsightAction[];
};

/** GET a Graph API endpoint with the user's token, following one page only (caller paginates if needed). */
// Retry on transient throttle/overload (429 rate-limit, 500/503) with exponential backoff + jitter,
// so a Meta rate-limit hiccup does not immediately fail the whole cockpit pull and trigger the
// user to refresh (which re-hammers the API - a retry storm). A hard error (400/401/403/404) is
// NOT retried. Every call also has an AbortController timeout so a slow Meta edge cannot hang the
// serverless invocation until the platform kills it.
const GRAPH_TIMEOUT_MS = 15_000;
const GRAPH_MAX_ATTEMPTS = 3;

async function graphGet<T>(path: string, token: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // ISSUE 15: pass the access token in the Authorization header, not the query string, so it never
  // lands in a URL that a proxy/log/error could capture. Graph API accepts Bearer auth.
  const headers = { Authorization: `Bearer ${token}` };
  // Caching is handled one level up by the cockpit cache (revalidated on switch / Re-scan).
  for (let attempt = 0; attempt < GRAPH_MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), GRAPH_TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), { signal: ctrl.signal, headers });
      if (res.ok) return (await res.json()) as T;
      const retryable = res.status === 429 || res.status === 500 || res.status === 503;
      if (retryable && attempt < GRAPH_MAX_ATTEMPTS - 1) {
        // 0.4s, 1.2s (+ up to 400ms jitter): spreads correlated retries so they do not re-collide.
        await new Promise((r) => setTimeout(r, 400 * 3 ** attempt + Math.floor(Math.random() * 400)));
        continue;
      }
      const detail = await res.text().catch(() => "");
      throw new Error(`Meta Graph ${res.status} on ${path}: ${detail.slice(0, 300)}`);
    } catch (e) {
      // A network error / timeout is retryable up to the cap; the last attempt rethrows.
      if (attempt < GRAPH_MAX_ATTEMPTS - 1 && (e instanceof Error && e.name === "AbortError" || e instanceof TypeError)) {
        await new Promise((r) => setTimeout(r, 400 * 3 ** attempt + Math.floor(Math.random() * 400)));
        continue;
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Meta Graph ${path}: exhausted retries`);
}

// GET every page of a Graph list endpoint by following the `after` cursor, up to maxPages
// (a hard ceiling so a runaway account cannot hang the request). This is what lets us pull
// deeper than one 500-row page - day-wise rows for many ads over a long window.
async function graphGetAll<Row>(path: string, token: string, params: Record<string, string>, maxPages = 12): Promise<Row[]> {
  const out: Row[] = [];
  let after: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const pageParams = after ? { ...params, after } : params;
    const json = await graphGet<{ data?: Row[]; paging?: { cursors?: { after?: string }; next?: string } }>(path, token, pageParams);
    for (const r of json.data ?? []) out.push(r);
    after = json.paging?.cursors?.after;
    if (!after || !json.paging?.next || (json.data?.length ?? 0) === 0) break;
  }
  return out;
}

// Accounts report purchases under different action types depending on their setup
// (omni_purchase already combines web + app + onsite, so it is preferred to avoid
// double counting; then the classic pixel type; then the plain aggregate). We take
// the first type that has a value, so a boAt-style account is not read as zero
// just because it does not use the offsite pixel type.
const PURCHASE_TYPES = ["omni_purchase", "offsite_conversion.fct_purchase", "purchase"];

function purchaseValue(list: MetaInsightAction[] | undefined): number {
  if (!list) return 0;
  for (const type of PURCHASE_TYPES) {
    const v = list.filter((a) => a.action_type === type).reduce((acc, a) => acc + Number(a.value || 0), 0);
    if (v > 0) return v;
  }
  return 0;
}

// Sum every value in a single-purpose action list (video plays, thruplays, outbound clicks).
function sumActions(list: MetaInsightAction[] | undefined): number {
  if (!list) return 0;
  return list.reduce((acc, a) => acc + Number(a.value || 0), 0);
}

// Sum the first action type (in preference order) that has a value - accounts report the
// same funnel step under different type names (omni_ vs offsite pixel), so we avoid double
// counting by taking the first non-zero, mirroring purchaseValue.
function firstActionValue(list: MetaInsightAction[] | undefined, types: string[]): number {
  if (!list) return 0;
  for (const t of types) {
    const v = list.filter((a) => a.action_type === t).reduce((acc, a) => acc + Number(a.value || 0), 0);
    if (v > 0) return v;
  }
  return 0;
}

export const metaSource: AdSource = {
  platform: "meta",

  async listAds(accountExternalId: string, token: TokenSet, campaignId?: string): Promise<SourceAd[]> {
    // accountExternalId is the numeric Meta ad account id (without the act_ prefix).
    // Large accounts return thousands of ads; requesting 200 with nested creative
    // expansion makes Meta reject the call with "reduce the amount of data" (code 1).
    // Ask only for the fields we use, cap the page small, and bias to ACTIVE ads
    // (the ones a weekly decision cares about, and the ones most likely to have spend).
    const params: Record<string, string> = {
      fields: "id,name,effective_status",
      effective_status: '["ACTIVE"]',
      limit: "25",
    };
    // Optional campaign filter (the topbar campaign picker). Narrows the pull to one campaign.
    if (campaignId) {
      params.filtering = JSON.stringify([{ field: "campaign.id", operator: "IN", value: [campaignId] }]);
    }
    const data = await graphGet<{ data: MetaAd[] }>(`act_${accountExternalId}/ads`, token.accessToken, params);
    return (data.data ?? []).map((ad) => ({
      externalId: ad.id,
      name: ad.name,
      mediaType: "unknown",
      status: ad.effective_status,
    }));
  },

  async fetchMetrics(adExternalId: string, since: string, token: TokenSet): Promise<MetricsRow[]> {
    const timeRange = JSON.stringify({ since, until: today() });
    const data = await graphGet<{ data: MetaInsightRow[] }>(`${adExternalId}/insights`, token.accessToken, {
      fields: "spend,impressions,clicks,frequency,actions,action_values",
      time_range: timeRange,
      time_increment: "1",
    });
    return (data.data ?? []).map((row) => ({
      adExternalId,
      date: row.date_start,
      spend: Number(row.spend || 0),
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      frequency: Number(row.frequency || 0),
      purchases: purchaseValue(row.actions),
      revenue: purchaseValue(row.action_values),
    }));
  },

  // Meta long-lived tokens are refreshed by re-exchanging, not a refresh_token grant.
  // Left minimal until the sync scheduler needs it.
  async refreshToken(_refreshToken: string): Promise<TokenSet> {
    throw new Error("Meta uses long-lived token exchange, not refresh_token grant");
  },
};

export type MetaAccountRef = { externalId: string; name: string; businessId?: string; businessName?: string };

/**
 * List the ad accounts the connected user can access (for the account picker). Plain
 * fields only: the nested business{} expansion could fail on large rosters and drop the
 * whole list, and /me/adaccounts already returns every account the token can reach (210
 * on a real agency user). Higher limit so nothing paginates off the end.
 */
export async function listMetaAdAccounts(token: TokenSet): Promise<MetaAccountRef[]> {
  // ISSUE 05: fully paginate (an agency user can have 200+ accounts). graphGetAll follows the cursor
  // instead of reading a single limit=500 page.
  const rows = await graphGetAll<MetaAdAccount>("me/adaccounts", token.accessToken, { fields: "account_id,name", limit: "500" }, 25);
  return rows.map((a) => ({ externalId: a.account_id, name: a.name ?? a.account_id }));
}

/** Businesses (BMs) the user can access, for grouping the account picker. */
export async function listMetaBusinesses(token: TokenSet): Promise<{ id: string; name: string }[]> {
  const rows = await graphGetAll<{ id: string; name?: string }>("me/businesses", token.accessToken, { fields: "id,name", limit: "100" }, 25); // ISSUE 05: paginate
  return rows.map((b) => ({ id: b.id, name: b.name ?? b.id }));
}

/**
 * Every ad account the user can reach: their direct accounts PLUS accounts owned by or
 * shared into the businesses (Business Managers) they belong to. This is how an agency
 * user sees all their client accounts, not just the ones directly assigned to them.
 * Best-effort: the business edges need the business_management permission, so each call
 * is guarded and the function still returns the direct accounts if those are denied.
 */
export async function listAllAccessibleAdAccounts(token: TokenSet): Promise<MetaAccountRef[]> {
  const byId = new Map<string, MetaAccountRef>();
  try {
    for (const a of await listMetaAdAccounts(token)) byId.set(a.externalId, a);
  } catch {
    // keep going; business edges may still work
  }
  try {
    const businesses = await listMetaBusinesses(token);
    for (const b of businesses) {
      for (const edge of ["owned_ad_accounts", "client_ad_accounts"]) {
        try {
          const rows = await graphGetAll<{ account_id: string; name?: string }>(
            `${b.id}/${edge}`,
            token.accessToken,
            { fields: "account_id,name", limit: "200" },
            25, // ISSUE 05: paginate the business edges too
          );
          for (const a of rows) {
            if (!byId.has(a.account_id)) {
              byId.set(a.account_id, { externalId: a.account_id, name: a.name ?? a.account_id, businessId: b.id, businessName: b.name });
            }
          }
        } catch {
          // this edge is not permitted / empty; skip it
        }
      }
    }
  } catch {
    // no business access; direct accounts already collected above
  }
  return Array.from(byId.values());
}

/**
 * Scheduled end date (unix seconds) per ad set, for the ads we analyze. Feeds the fatigue
 * half-life: a creative cannot outlive its ad set, so the half-life is capped at the end date.
 * Ad sets with no end_time are simply absent from the map (open-ended). Paginated + filtered.
 */
export async function listAdSetEnds(accountExternalId: string, adsetIds: string[], token: TokenSet): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (adsetIds.length === 0) return map;
  const rows = await graphGetAll<{ id: string; end_time?: string }>(`act_${accountExternalId}/adsets`, token.accessToken, {
    fields: "id,end_time",
    filtering: JSON.stringify([{ field: "id", operator: "IN", value: adsetIds }]),
    limit: "200",
  });
  for (const a of rows) {
    if (!a.end_time) continue;
    const t = Math.floor(new Date(a.end_time).getTime() / 1000);
    if (Number.isFinite(t)) map.set(a.id, t);
  }
  return map;
}

// Raw Graph creative shape (only the fields we normalize). object_story_spec / asset_feed_spec
// are where the real copy + CTA + carousel structure live; the top-level image_url/body/title
// are unreliable, so we read from the spec first and fall back.
type MetaStorySpec = {
  link_data?: { message?: string; name?: string; picture?: string; call_to_action?: { type?: string }; child_attachments?: unknown[] };
  video_data?: { message?: string; title?: string; video_id?: string; call_to_action?: { type?: string } };
};
type MetaAssetFeed = {
  bodies?: { text?: string }[];
  titles?: { text?: string }[];
  call_to_action_types?: string[];
  images?: unknown[];
  videos?: unknown[];
};
type MetaCreative = {
  id?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  body?: string;
  title?: string;
  product_set_id?: string; // present iff this is a catalog / dynamic product ad
  object_story_spec?: MetaStorySpec;
  asset_feed_spec?: MetaAssetFeed;
};

const first = <T>(a: T[] | undefined): T | undefined => (a && a.length > 0 ? a[0] : undefined);

function normalizeCreative(adId: string, c: MetaCreative | undefined): CreativeAsset {
  const spec = c?.object_story_spec;
  const feed = c?.asset_feed_spec;
  const link = spec?.link_data;
  const video = spec?.video_data;

  const videoId = c?.video_id ?? video?.video_id ?? null;
  const children = link?.child_attachments?.length ?? 0;
  const feedAssets = (feed?.images?.length ?? 0) + (feed?.videos?.length ?? 0);
  const assetCount = Math.max(1, children, feedAssets);

  const title = c?.title ?? link?.name ?? video?.title ?? first(feed?.titles)?.text ?? null;
  const body = c?.body ?? link?.message ?? video?.message ?? first(feed?.bodies)?.text ?? null;
  const ctaType = link?.call_to_action?.type ?? video?.call_to_action?.type ?? first(feed?.call_to_action_types) ?? null;

  return {
    adId,
    creativeId: c?.id ?? null,
    imageUrl: c?.image_url ?? link?.picture ?? null,
    videoThumbUrl: c?.thumbnail_url ?? null,
    videoId,
    title: title ?? null,
    body: body ?? null,
    ctaType: ctaType ?? null,
    isVideo: Boolean(videoId),
    isCarousel: children > 1 || feedAssets > 1,
    isCatalog: Boolean(c?.product_set_id),
    assetCount,
  };
}

/**
 * Creative asset per ad, for the own-ad creative fingerprint. Fetched via the batch `?ids=`
 * endpoint (up to 50 ads per call) so a 100-ad account is 2 round-trips, not 100. A single
 * ad that errors is simply absent from the map - the caller falls back to no fingerprint for
 * it rather than failing the whole run. No fabrication: absent creative = absent entry.
 */
export async function fetchAdCreatives(accountExternalId: string, adIds: string[], token: TokenSet): Promise<Map<string, CreativeAsset>> {
  const out = new Map<string, CreativeAsset>();
  if (adIds.length === 0) return out;
  const fields = "creative{id,thumbnail_url,image_url,video_id,body,title,product_set_id,object_story_spec,asset_feed_spec}";
  // Per-AD requests, not the ?ids= batch param: Meta deprecated ?ids= (code 100, "deprecated in
  // v26.0+") so the batch call returns a hard error and every ad reads as "unknown" format. A bounded
  // worker pool keeps 100 ads fast without a request storm; one ad's failure is isolated.
  const CONCURRENCY = 12;
  const queue = [...adIds];
  async function worker() {
    for (;;) {
      const id = queue.shift();
      if (!id) return;
      try {
        const json = await graphGet<{ creative?: MetaCreative }>(id, token.accessToken, { fields });
        if (json?.creative) out.set(id, normalizeCreative(id, json.creative));
      } catch {
        // this ad has no fingerprint this run; keep going
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, adIds.length) }, worker));
  return out;
}

/** Recent ad names in an account, ANY status (active or paused), for brand understanding - one cheap
 * call (names only, no insights). Unlike listAds this does NOT filter to ACTIVE, so an account whose
 * ads recently spent but are now paused still yields names to learn from. [] on any failure. */
export async function fetchRecentAdNames(accountExternalId: string, token: TokenSet, limit = 50): Promise<string[]> {
  try {
    const data = await graphGet<{ data: { name?: string }[] }>(`act_${accountExternalId}/ads`, token.accessToken, {
      fields: "name",
      limit: String(limit),
    });
    return (data.data ?? []).map((a) => a.name).filter((n): n is string => Boolean(n));
  } catch {
    return [];
  }
}

// Hosts that are never a brand's own website: social / messaging / link-in-bio aggregators and the big
// marketplaces (a brand may advertise its Amazon listing, but that is not "the brand's website").
const NON_BRAND_HOSTS = new Set([
  "facebook.com", "l.facebook.com", "fb.me", "instagram.com", "wa.me", "api.whatsapp.com", "whatsapp.com",
  "linktr.ee", "bit.ly", "cutt.ly", "youtube.com", "youtu.be", "t.me", "twitter.com", "x.com", "pinterest.com",
  "amazon.in", "amazon.com", "flipkart.com", "myntra.com", "ajio.com", "meesho.com", "nykaa.com",
]);

// Strip a hostname to its registrable-ish form (drop a leading www.) for grouping + display.
function normalizeHost(raw: string): string | null {
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * The brand's own website host from a list of landing URLs: the most common real brand domain, with
 * social/messaging/marketplace hosts used only as a last resort (a link to the brand's Amazon page is
 * not its website). Pure - the network part lives in fetchBrandWebsite. Returns "soch.com" or null.
 */
export function pickBrandWebsiteHost(urls: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  const fallback = new Map<string, number>();
  for (const raw of urls) {
    if (!raw) continue;
    const host = normalizeHost(raw);
    if (!host) continue;
    const m = NON_BRAND_HOSTS.has(host) ? fallback : counts;
    m.set(host, (m.get(host) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return top(counts) ?? top(fallback);
}

/**
 * The brand's OWN website, discovered from real ad data - never guessed. A brand's own ads point their
 * CTA at the brand's own domain, so the most common landing host across recent ads IS the website
 * (e.g. Soch's ads all link to soch.com). Reads link_data.link, video CTA link, and asset_feed_spec
 * link_urls from recent creatives via the token already in hand - no third-party service, no LLM.
 * Social / messaging / marketplace hosts are excluded (a link to the brand's Amazon page is not its
 * site). Returns the registrable host (e.g. "soch.com") or null when no own-domain link is found.
 */
export async function fetchBrandWebsite(accountExternalId: string, token: TokenSet, limit = 40): Promise<string | null> {
  type LinkCreative = {
    creative?: {
      object_story_spec?: {
        link_data?: { link?: string };
        video_data?: { call_to_action?: { value?: { link?: string } } };
      };
      asset_feed_spec?: { link_urls?: { website_url?: string }[] };
    };
  };
  let ads: LinkCreative[] = [];
  try {
    const data = await graphGet<{ data: LinkCreative[] }>(`act_${accountExternalId}/ads`, token.accessToken, {
      fields: "creative{object_story_spec{link_data{link},video_data{call_to_action{value{link}}}},asset_feed_spec{link_urls{website_url}}}",
      limit: String(limit),
    });
    ads = data.data ?? [];
  } catch {
    return null;
  }

  // Every landing host across recent ads; pickBrandWebsiteHost prefers a real brand domain.
  const urls = ads.flatMap((ad) => {
    const c = ad.creative;
    return [
      c?.object_story_spec?.link_data?.link,
      c?.object_story_spec?.video_data?.call_to_action?.value?.link,
      ...(c?.asset_feed_spec?.link_urls ?? []).map((l) => l.website_url),
    ];
  });
  return pickBrandWebsiteHost(urls);
}

// ---------------------------------------------------------------------------------------------------
// Meta Ad Library (ads_archive) - competitor research from Meta's OWN public transparency data, using
// the user's already-connected token. This is the free, first-party replacement for ScrapeCreators
// (which is a paid third party). ads_archive exposes, for any advertiser: the page, the ad COPY
// (bodies/titles/link captions), CTA-adjacent link text, run dates, platforms, and the snapshot URL.
// It does NOT expose media format or media files for ordinary commercial ads, so competitor format-mix
// and thumbnails are unavailable from this source (copy-based intelligence - ICP, pillars, offers,
// hooks - is fully available). Nothing is fabricated: a field the API omits is null/other.
// ---------------------------------------------------------------------------------------------------

// Non-EU commercial ads expose only these fields on ads_archive; impressions/spend/demographics are
// EU-political-only and deliberately not requested.
const AD_LIBRARY_FIELDS =
  "id,page_id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,ad_creative_link_descriptions,ad_snapshot_url,ad_delivery_start_time,ad_delivery_stop_time,publisher_platforms";

type AdLibraryRawAd = {
  id?: string;
  page_id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[]; // the display host shown under the headline, e.g. "soch.com"
  ad_creative_link_descriptions?: string[];
  ad_snapshot_url?: string;
  ad_delivery_start_time?: string; // ISO date
  ad_delivery_stop_time?: string; // absent while the ad is still running
  publisher_platforms?: string[];
};

// A very small country-name -> ISO-2 map for the ad_reached_countries filter, with a currency-based
// fallback. ads_archive REQUIRES a reached-country, so we always resolve to something sensible.
const MARKET_ISO2: Record<string, string> = {
  india: "IN", "united states": "US", usa: "US", us: "US", "united kingdom": "GB", uk: "GB",
  canada: "CA", australia: "AU", uae: "AE", "united arab emirates": "AE", singapore: "SG",
  germany: "DE", france: "FR", indonesia: "ID", pakistan: "PK", bangladesh: "BD",
};
export function iso2FromMarket(targetMarket: string | null, currency?: string | null): string {
  const t = (targetMarket ?? "").trim().toLowerCase();
  if (t && MARKET_ISO2[t]) return MARKET_ISO2[t];
  for (const [name, iso] of Object.entries(MARKET_ISO2)) if (t.includes(name)) return iso;
  if (currency === "INR") return "IN";
  if (currency === "GBP") return "GB";
  if (currency === "AED") return "AE";
  return "US"; // the broadest Ad Library; only used when the market is genuinely unknown
}

function firstNonEmpty(list: string[] | undefined): string | null {
  return list?.find((s) => s && s.trim())?.trim() ?? null;
}

function toEpochSeconds(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function normalizeAdLibraryAd(raw: AdLibraryRawAd, label: string, isMyBrand: boolean): NormalizedAd | null {
  if (!raw.page_id || !raw.id) return null; // an ad we cannot key is dropped, not faked
  const caption = firstNonEmpty(raw.ad_creative_link_captions); // display host, e.g. "www.soch.com"
  const cardCount = Math.max(raw.ad_creative_bodies?.length ?? 1, raw.ad_creative_link_titles?.length ?? 1);
  return {
    pageId: String(raw.page_id),
    adArchiveId: String(raw.id),
    brandLabel: raw.page_name || label,
    isMyBrand,
    isActive: !raw.ad_delivery_stop_time, // no stop time = still delivering (best-effort from public data)
    displayFormat: "", // ads_archive does not expose media format for commercial ads
    media: "other", // unknown from this source; copy-based analysis still works
    ctaText: null,
    ctaType: null,
    title: firstNonEmpty(raw.ad_creative_link_titles),
    body: firstNonEmpty(raw.ad_creative_bodies) ?? firstNonEmpty(raw.ad_creative_link_descriptions),
    linkUrl: caption ? (caption.includes("://") ? caption : `https://${caption}`) : null,
    platforms: Array.isArray(raw.publisher_platforms) ? raw.publisher_platforms : [],
    startDate: toEpochSeconds(raw.ad_delivery_start_time),
    endDate: toEpochSeconds(raw.ad_delivery_stop_time),
    cardCount: cardCount > 1 ? cardCount : 1,
    adUrl: raw.ad_snapshot_url ?? `https://www.facebook.com/ads/library/?id=${raw.id}`,
    imageUrl: null,
    videoUrl: null,
    videoThumbUrl: null,
  };
}

/**
 * Discover competitor pages by searching the Ad Library for advertisers running ads that match the
 * brand's category / key products in a country. These are REAL brands actively advertising the same
 * things - the most honest competitor signal there is. Returns Candidate[] (likes carries the ad count
 * so the shared shortlist ranks the heaviest advertisers first). Own brand is dropped by the caller's
 * shortlist. Throws on a Graph error (e.g. the token lacks Ad Library access) so the route reports it.
 */
export async function searchAdLibraryPages(searchTerms: string, country: string, token: TokenSet, limit = 10): Promise<Candidate[]> {
  const q = searchTerms.trim();
  if (!q) return [];
  const rows = await graphGetAll<AdLibraryRawAd>(
    "ads_archive",
    token.accessToken,
    {
      search_terms: q,
      ad_reached_countries: JSON.stringify([country]),
      ad_active_status: "ACTIVE",
      ad_type: "ALL",
      fields: "id,page_id,page_name",
      limit: "100",
    },
    3, // ~300 ads is plenty to surface the distinct advertiser pages in a category
  );
  const byPage = new Map<string, { name: string; count: number }>();
  for (const r of rows) {
    if (!r.page_id) continue;
    const id = String(r.page_id);
    const e = byPage.get(id) ?? { name: r.page_name ?? `Page ${id}`, count: 0 };
    e.count += 1;
    if (r.page_name) e.name = r.page_name;
    byPage.set(id, e);
  }
  return [...byPage.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([pageId, v]) => ({ pageId, name: v.name, category: null, likes: v.count, verified: false }));
}

/**
 * Fetch and normalize a competitor's live Ad Library ads by page id, via ads_archive. `label`/`isMyBrand`
 * tag the rows for the analytics split. Media format/files are null (not exposed for commercial ads);
 * the copy, CTA link text, landing host, dates, and platforms are real. Throws on a Graph error.
 */
export async function fetchAdLibraryAds(
  pageId: string,
  label: string,
  isMyBrand: boolean,
  country: string,
  token: TokenSet,
  limit = 40,
): Promise<NormalizedAd[]> {
  const rows = await graphGetAll<AdLibraryRawAd>(
    "ads_archive",
    token.accessToken,
    {
      search_page_ids: JSON.stringify([pageId]),
      ad_reached_countries: JSON.stringify([country]),
      ad_active_status: "ALL",
      ad_type: "ALL",
      fields: AD_LIBRARY_FIELDS,
      limit: "50",
    },
    Math.ceil(limit / 50) + 1,
  );
  const out: NormalizedAd[] = [];
  for (const r of rows) {
    const ad = normalizeAdLibraryAd(r, label, isMyBrand);
    if (ad) out.push(ad);
  }
  return out.slice(0, limit);
}

/** The ad account's ISO currency (act_<id>?fields=currency), for brand understanding. null on any failure. */
export async function fetchAccountCurrency(accountExternalId: string, token: TokenSet): Promise<string | null> {
  try {
    const json = await graphGet<{ currency?: string }>(`act_${accountExternalId}`, token.accessToken, { fields: "currency" });
    return json.currency ?? null;
  } catch {
    return null;
  }
}

/** The ad account's reporting timezone (e.g. "Asia/Kolkata"), so date windows match Meta's calendar
 * (ISSUE 29). null on any failure - the caller falls back to UTC semantics. */
export async function fetchAccountTimezone(accountExternalId: string, token: TokenSet): Promise<string | null> {
  try {
    const json = await graphGet<{ timezone_name?: string }>(`act_${accountExternalId}`, token.accessToken, { fields: "timezone_name" });
    return json.timezone_name ?? null;
  } catch {
    return null;
  }
}

/** Active campaigns in an ad account (numeric id, no act_ prefix), for the campaign filter. */
export async function listMetaCampaigns(
  accountExternalId: string,
  token: TokenSet,
): Promise<{ id: string; name: string; objective?: string }[]> {
  // ISSUE 05: paginate the campaign picker (was a single limit=100 page) so a large account can't
  // hide campaigns the user is allowed to select. Matches how listAllCampaignObjectives paginates.
  const rows = await graphGetAll<{ id: string; name?: string; objective?: string }>(
    `act_${accountExternalId}/campaigns`,
    token.accessToken,
    { fields: "id,name,objective", effective_status: '["ACTIVE"]', limit: "100" },
    25,
  );
  return rows.map((c) => ({ id: c.id, name: c.name ?? c.id, objective: c.objective }));
}

/**
 * Every campaign's objective in the account, ALL statuses, paginated. This is the source of
 * truth for the objective filter: a campaign that spent in the window but is now paused, in
 * review, or completed still counts, and an account with more than one page of campaigns is
 * fully covered. Distinct from listMetaCampaigns (ACTIVE-only, single page) which powers the
 * campaign PICKER UI - a filter must see paused/old campaigns; a picker should not list them.
 */
export async function listAllCampaignObjectives(
  accountExternalId: string,
  token: TokenSet,
): Promise<{ id: string; objective?: string }[]> {
  const rows = await graphGetAll<{ id: string; objective?: string }>(
    `act_${accountExternalId}/campaigns`,
    token.accessToken,
    { fields: "id,objective", limit: "500" },
    20,
  );
  return rows.map((c) => ({ id: c.id, objective: c.objective }));
}

export type AdMeta = { status?: string; adsetName?: string; campaignName?: string };

/**
 * Per-ad metadata in ONE batch ?ids= call (50 per request): current effective_status + the ad
 * set NAME + the campaign NAME. effective_status ROLLS UP the campaign -> ad set -> ad pause
 * state, so "ACTIVE" means all three are live; anything else is not actively spending (used to
 * hide paused ads from suggestions). The names make every money figure traceable to a readable
 * campaign / ad set, not just an id. An ad missing from the map = unknown (caller treats status
 * as active so we never hide a real budget leak). Best-effort: a failed batch is just skipped.
 */
export async function fetchAdMeta(accountExternalId: string, adIds: string[], token: TokenSet): Promise<Map<string, AdMeta>> {
  const out = new Map<string, AdMeta>();
  if (adIds.length === 0) return out;
  // Per-AD requests, not the deprecated ?ids= batch param (see fetchAdCreatives). Without this the
  // status/name lookup fails silently: no paused ads get hidden and no ad-set/campaign names show.
  type MetaAdMetaJson = { effective_status?: string; adset?: { name?: string }; campaign?: { name?: string } };
  const CONCURRENCY = 12;
  const queue = [...adIds];
  async function worker() {
    for (;;) {
      const id = queue.shift();
      if (!id) return;
      try {
        const e = await graphGet<MetaAdMetaJson>(id, token.accessToken, { fields: "effective_status,adset{name},campaign{name}" });
        if (e) out.set(id, { status: e.effective_status, adsetName: e.adset?.name, campaignName: e.campaign?.name });
      } catch {
        // this ad stays unknown; keep going
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, adIds.length) }, worker));
  return out;
}

export type ScopeInsights = { spend: number; impressions: number; clicks: number; purchases: number; revenue: number };

/**
 * TRUE totals for the current scope over the window, so the dashboard KPIs match Ads Manager.
 * This is level=campaign, summed across EVERY campaign in scope (paginated), NOT the sum of the
 * top-N analyzed ads. That distinction is the whole point: we deep-analyze the top ads for the
 * leaderboard/fatigue, but the headline spend/revenue/ROAS must reflect all campaigns, ad sets
 * and ads of the selected objective - which is exactly what Ads Manager shows when you filter to
 * that objective. campaignIds scopes it: undefined = whole account; [ids] = those campaigns;
 * [] = nothing in scope (an objective with no campaigns) -> all zeros, an honest empty state.
 */
// ISSUE 06: a campaign IN filter with thousands of ids becomes an oversized query payload. Chunk the
// ids into bounded batches; campaigns are disjoint across batches, so per-batch results aggregate
// exactly (sum for totals, concat+re-sort for top-N). A set at/under the chunk size is a single batch,
// i.e. identical to the old single-call behavior - only large accounts split.
export const CAMPAIGN_FILTER_CHUNK = 50;
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
const campaignFilter = (ids: string[]) => JSON.stringify([{ field: "campaign.id", operator: "IN", value: ids }]);

export async function fetchScopeInsights(
  accountExternalId: string,
  since: string,
  token: TokenSet,
  campaignIds?: string[],
  until?: string,
): Promise<ScopeInsights> {
  const empty: ScopeInsights = { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
  if (campaignIds && campaignIds.length === 0) return empty;
  const baseParams: Record<string, string> = {
    level: "campaign",
    fields: "spend,impressions,clicks,actions,action_values",
    time_range: JSON.stringify({ since, until: until ?? today() }),
    limit: "500",
  };
  // undefined campaignIds = whole account (one unfiltered call); otherwise one call per id-chunk.
  const batches = campaignIds ? chunk(campaignIds, CAMPAIGN_FILTER_CHUNK) : [null];
  const perBatch = await Promise.all(
    batches.map((ids) => {
      const params = ids ? { ...baseParams, filtering: campaignFilter(ids) } : baseParams;
      return graphGetAll<MetaInsightRow>(`act_${accountExternalId}/insights`, token.accessToken, params, 20);
    }),
  );
  return perBatch.flat().reduce<ScopeInsights>((acc, r) => {
    acc.spend += Number(r.spend || 0);
    acc.impressions += Number(r.impressions || 0);
    acc.clicks += Number(r.clicks || 0);
    acc.purchases += purchaseValue(r.actions);
    acc.revenue += purchaseValue(r.action_values);
    return acc;
  }, { ...empty });
}

/**
 * Top ads by spend in the window, via account-level insights (level=ad, sorted by
 * spend). This surfaces the ads that actually matter on a big account, instead of the
 * arbitrary first-N active ads (which skew to low-spend awareness creative). Returns
 * only ads that spent in the window, best first. Empty array if none spent.
 */
export async function listTopSpendingAds(
  accountExternalId: string,
  since: string,
  token: TokenSet,
  campaignIds?: string[],
  limit = 25,
  until?: string,
): Promise<{ externalId: string; name: string }[]> {
  // campaignIds semantics: undefined = no filter (all campaigns); [] = filter matches
  // nothing (e.g. an objective with no active campaigns), so return nothing rather than
  // silently falling back to unfiltered ads.
  if (campaignIds && campaignIds.length === 0) return [];
  const baseParams: Record<string, string> = {
    level: "ad",
    fields: "ad_id,ad_name,spend",
    // until defaults to today so a plain since-only call (a preset window) is unchanged;
    // an explicit range passes both bounds.
    time_range: JSON.stringify({ since, until: until ?? today() }),
    sort: "spend_descending",
    limit: String(limit),
  };
  // ISSUE 06: chunk a large campaign filter. Each batch returns its own top-`limit` by spend; any ad
  // in the GLOBAL top-`limit` is in its batch's top-`limit`, so concat + re-sort by spend + slice is
  // exact. One batch (<= chunk size) is identical to the old single call.
  const batches = campaignIds ? chunk(campaignIds, CAMPAIGN_FILTER_CHUNK) : [null];
  const perBatch = await Promise.all(
    batches.map((ids) => {
      const params = ids ? { ...baseParams, filtering: campaignFilter(ids) } : baseParams;
      return graphGet<{ data: { ad_id: string; ad_name?: string; spend?: string }[] }>(`act_${accountExternalId}/insights`, token.accessToken, params);
    }),
  );
  const all = perBatch.flatMap((d) => d.data ?? []);
  all.sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0));
  return all.slice(0, limit).map((r) => ({ externalId: r.ad_id, name: r.ad_name ?? r.ad_id }));
}

/**
 * Map a raw Meta campaign objective (legacy or ODAX naming) to our internal Objective
 * (J2: same-objective comparison only). Case-insensitive substring match; order matters
 * since the broad SALES/ENGAGEMENT buckets would otherwise swallow LEAD/APP/AWARENESS/TRAFFIC.
 * Unknown or missing objective falls back to "conversion" (the prior, safe default).
 */
export function mapMetaObjective(raw?: string): Objective {
  const o = (raw ?? "").toUpperCase();
  if (o.includes("LEAD")) return "leads";
  if (o.includes("APP")) return "app_installs";
  if (o.includes("AWARENESS") || o.includes("REACH") || o.includes("RECALL")) return "awareness";
  if (o.includes("TRAFFIC") || o.includes("LINK_CLICK")) return "traffic";
  if (o.includes("SALES") || o.includes("CONVERSION") || o.includes("PURCHASE") || o.includes("CATALOG")) return "conversion";
  if (o.includes("ENGAGEMENT") || o.includes("VIDEO") || o.includes("POST") || o.includes("PAGE_LIKE") || o.includes("MESSAGE") || o.includes("EVENT")) return "engagement";
  return "conversion";
}

/**
 * Daily metric rows for a set of ads in ONE account-level insights call (level=ad,
 * time_increment=1, filtered to those ad ids). Replaces N per-ad calls: for 25 ads
 * this is a single request instead of 25, which is the difference between a snappy
 * page and a very slow one. Returns rows grouped by ad id, plus each ad's raw campaign
 * objective (constant across its rows, so we just take it from any row).
 */
export async function fetchAdInsights(
  accountExternalId: string,
  adExternalIds: string[],
  since: string,
  token: TokenSet,
  until?: string,
): Promise<Map<string, { rows: MetricsRow[]; objective?: string; campaignId?: string; adsetId?: string }>> {
  const byAd = new Map<string, { rows: MetricsRow[]; objective?: string; campaignId?: string; adsetId?: string }>();
  if (adExternalIds.length === 0) return byAd;
  const params: Record<string, string> = {
    level: "ad",
    // campaign_id + adset_id let us report how many campaigns / ad sets / ads a run processed;
    // the video + outbound-click fields feed the D2C funnel metrics (thumb-stop, hold, LP...).
    fields:
      "ad_id,campaign_id,adset_id,date_start,spend,impressions,clicks,frequency,actions,action_values,objective,video_play_actions,video_thruplay_watched_actions,outbound_clicks",
    // until defaults to today so existing preset callers are unaffected; a range passes both.
    time_range: JSON.stringify({ since, until: until ?? today() }),
    time_increment: "1",
    limit: "500",
    filtering: JSON.stringify([{ field: "ad.id", operator: "IN", value: adExternalIds }]),
  };
  // day-wise rows = ads x days. The default 12-page cap (6000 rows) SILENTLY TRUNCATES a real
  // account on 60-90 day windows (100 ads x 90d = 9000 rows), under-counting spend/ROAS with no
  // error. Size the cap to the actual volume needed (+buffer), so nothing is dropped; hard-capped
  // so a bad range can never loop forever.
  const spanDays = Math.max(1, Math.round((new Date(until ?? today()).getTime() - new Date(since).getTime()) / 86_400_000) + 1);
  const maxPages = Math.min(60, Math.ceil((adExternalIds.length * spanDays) / 500) + 2);
  const rows = await graphGetAll<
    MetaInsightRow & {
      ad_id: string;
      objective?: string;
      campaign_id?: string;
      adset_id?: string;
      video_play_actions?: MetaInsightAction[];
      video_thruplay_watched_actions?: MetaInsightAction[];
      outbound_clicks?: MetaInsightAction[];
    }
  >(`act_${accountExternalId}/insights`, token.accessToken, params, maxPages);
  for (const row of rows) {
    const entry = byAd.get(row.ad_id) ?? { rows: [], objective: undefined };
    if (!entry.campaignId && row.campaign_id) entry.campaignId = row.campaign_id;
    if (!entry.adsetId && row.adset_id) entry.adsetId = row.adset_id;
    entry.rows.push({
      adExternalId: row.ad_id,
      date: row.date_start,
      spend: Number(row.spend || 0),
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      frequency: Number(row.frequency || 0),
      purchases: purchaseValue(row.actions),
      revenue: purchaseValue(row.action_values),
      video3sViews: sumActions(row.video_play_actions),
      videoThruplays: sumActions(row.video_thruplay_watched_actions),
      outboundClicks: sumActions(row.outbound_clicks),
      landingPageViews: firstActionValue(row.actions, ["landing_page_view", "omni_landing_page_view"]),
      addToCarts: firstActionValue(row.actions, ["add_to_cart", "omni_add_to_cart", "offsite_conversion.fct_add_to_cart"]),
      initiateCheckouts: firstActionValue(row.actions, ["initiate_checkout", "omni_initiated_checkout", "offsite_conversion.fct_initiate_checkout"]),
    });
    if (!entry.objective && row.objective) entry.objective = row.objective;
    byAd.set(row.ad_id, entry);
  }
  return byAd;
}

function today(): string {
  // ponytail: date-only string for Graph's time_range. Uses the server clock at call time.
  return new Date().toISOString().slice(0, 10);
}

// One flat day-wise metrics row for the ad_metrics ingestion store: the same fields the analytics read,
// plus the ad/campaign/adset ids + raw objective, so the store carries everything without a second call.
export type AdMetricRow = {
  adId: string;
  date: string;
  campaignId: string | null;
  adsetId: string | null;
  objective: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  frequency: number;
  purchases: number;
  revenue: number;
  video3s: number;
  videoThruplays: number;
  outboundClicks: number;
  landingPageViews: number;
  addToCarts: number;
  initiateCheckouts: number;
};

/**
 * COMPLETE-COVERAGE day-wise pull for the ingestion pipeline: EVERY ad with activity in the window - no
 * top-N cap and no ad-id filter, so a $100M/month brand's thousands of ads are all captured. Meta returns
 * every ad at level=ad and paginates; we follow the cursor to the end (bounded by maxPages as a runaway
 * guard, sized far above any real account). Optional campaign filter for scoped syncs. This is a BACKGROUND
 * job's tool (the cron/worker has the time budget); it must NOT be called on a page-load request path.
 */
type DayWiseRaw = MetaInsightRow & {
  ad_id: string;
  campaign_id?: string;
  adset_id?: string;
  objective?: string;
  video_play_actions?: MetaInsightAction[];
  video_thruplay_watched_actions?: MetaInsightAction[];
  outbound_clicks?: MetaInsightAction[];
};

function mapDayWiseRow(row: DayWiseRaw): AdMetricRow {
  return {
    adId: row.ad_id,
    date: row.date_start,
    campaignId: row.campaign_id ?? null,
    adsetId: row.adset_id ?? null,
    objective: row.objective ?? null,
    spend: Number(row.spend || 0),
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    frequency: Number(row.frequency || 0),
    purchases: purchaseValue(row.actions),
    revenue: purchaseValue(row.action_values),
    video3s: sumActions(row.video_play_actions),
    videoThruplays: sumActions(row.video_thruplay_watched_actions),
    outboundClicks: sumActions(row.outbound_clicks),
    landingPageViews: firstActionValue(row.actions, ["landing_page_view", "omni_landing_page_view"]),
    addToCarts: firstActionValue(row.actions, ["add_to_cart", "omni_add_to_cart", "offsite_conversion.fct_add_to_cart"]),
    initiateCheckouts: firstActionValue(row.actions, ["initiate_checkout", "omni_initiated_checkout", "offsite_conversion.fct_initiate_checkout"]),
  };
}

/**
 * STREAMING complete-coverage pull: paginates every ad's day-wise rows and hands each PAGE to `onBatch`
 * as it arrives, instead of buffering the whole account in memory. This is what makes the ingestion both
 * scalable (a 5,000-ad brand never holds 450k rows in memory) and resilient (each page is persisted
 * immediately, so a run cut short still makes progress and the next run continues). Returns the total
 * rows streamed. Background-job tool only. onBatch is awaited so back-pressure (the DB write) paces the pull.
 */
export async function streamAccountDayWiseRows(
  accountExternalId: string,
  since: string,
  token: TokenSet,
  onBatch: (rows: AdMetricRow[]) => Promise<void>,
  until?: string,
  campaignIds?: string[],
  maxPages = 400,
): Promise<number> {
  if (campaignIds && campaignIds.length === 0) return 0;
  const params: Record<string, string> = {
    level: "ad",
    fields:
      "ad_id,campaign_id,adset_id,date_start,spend,impressions,clicks,frequency,actions,action_values,objective,video_play_actions,video_thruplay_watched_actions,outbound_clicks",
    time_range: JSON.stringify({ since, until: until ?? today() }),
    time_increment: "1",
    limit: "500",
  };
  if (campaignIds) params.filtering = JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }]);
  let after: string | undefined;
  let total = 0;
  for (let page = 0; page < maxPages; page++) {
    const pageParams = after ? { ...params, after } : params;
    const json = await graphGet<{ data?: DayWiseRaw[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      `act_${accountExternalId}/insights`,
      token.accessToken,
      pageParams,
    );
    const mapped = (json.data ?? []).filter((r) => r.ad_id).map(mapDayWiseRow);
    if (mapped.length > 0) {
      await onBatch(mapped);
      total += mapped.length;
    }
    after = json.paging?.cursors?.after;
    if (!after || !json.paging?.next || (json.data?.length ?? 0) === 0) break;
  }
  return total;
}
