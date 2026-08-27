// Meta implementation of the AdSource interface (ADR-0002). Real Graph API calls
// (Marketing API v21) against a connected user's token. No Claude/MCP anywhere:
// this runs inside the deployed app with the END USER's own OAuth token.
// Pure data-fetching; scoring/verdicts happen in the rules engine, not here.

import type { AdSource, TokenSet, SourceAd, MetricsRow } from "./ad-source.ts";
import type { Objective } from "./rules/comparator.ts";
import type { CreativeAsset } from "./creative/fingerprint.ts";

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
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Caching is handled one level up by the cockpit cache (revalidated on switch / Re-scan).
  for (let attempt = 0; attempt < GRAPH_MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), GRAPH_TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), { signal: ctrl.signal });
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
  const data = await graphGet<{ data: MetaAdAccount[] }>("me/adaccounts", token.accessToken, {
    fields: "account_id,name",
    limit: "500",
  });
  return (data.data ?? []).map((a) => ({ externalId: a.account_id, name: a.name ?? a.account_id }));
}

/** Businesses (BMs) the user can access, for grouping the account picker. */
export async function listMetaBusinesses(token: TokenSet): Promise<{ id: string; name: string }[]> {
  const data = await graphGet<{ data: { id: string; name?: string }[] }>("me/businesses", token.accessToken, {
    fields: "id,name",
    limit: "100",
  });
  return (data.data ?? []).map((b) => ({ id: b.id, name: b.name ?? b.id }));
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
          const data = await graphGet<{ data: { account_id: string; name?: string }[] }>(
            `${b.id}/${edge}`,
            token.accessToken,
            { fields: "account_id,name", limit: "200" },
          );
          for (const a of data.data ?? []) {
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
  const fields = "creative{id,thumbnail_url,image_url,video_id,body,title,object_story_spec,asset_feed_spec}";
  for (let i = 0; i < adIds.length; i += 50) {
    const batch = adIds.slice(i, i + 50);
    try {
      const json = await graphGet<Record<string, { creative?: MetaCreative }>>("", token.accessToken, {
        ids: batch.join(","),
        fields,
      });
      for (const adId of batch) {
        const entry = json[adId];
        if (entry) out.set(adId, normalizeCreative(adId, entry.creative));
      }
    } catch {
      // A bad batch just means those ads have no fingerprint this run; keep going.
    }
  }
  return out;
}

/** Active campaigns in an ad account (numeric id, no act_ prefix), for the campaign filter. */
export async function listMetaCampaigns(
  accountExternalId: string,
  token: TokenSet,
): Promise<{ id: string; name: string; objective?: string }[]> {
  const data = await graphGet<{ data: { id: string; name?: string; objective?: string }[] }>(
    `act_${accountExternalId}/campaigns`,
    token.accessToken,
    { fields: "id,name,objective", effective_status: '["ACTIVE"]', limit: "100" },
  );
  return (data.data ?? []).map((c) => ({ id: c.id, name: c.name ?? c.id, objective: c.objective }));
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
  for (let i = 0; i < adIds.length; i += 50) {
    const batch = adIds.slice(i, i + 50);
    try {
      const json = await graphGet<Record<string, { effective_status?: string; adset?: { name?: string }; campaign?: { name?: string } }>>(
        "",
        token.accessToken,
        { ids: batch.join(","), fields: "effective_status,adset{name},campaign{name}" },
      );
      for (const adId of batch) {
        const e = json[adId];
        if (e) out.set(adId, { status: e.effective_status, adsetName: e.adset?.name, campaignName: e.campaign?.name });
      }
    } catch {
      // this batch stays unknown; keep going
    }
  }
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
export async function fetchScopeInsights(
  accountExternalId: string,
  since: string,
  token: TokenSet,
  campaignIds?: string[],
  until?: string,
): Promise<ScopeInsights> {
  const empty: ScopeInsights = { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
  if (campaignIds && campaignIds.length === 0) return empty;
  const params: Record<string, string> = {
    level: "campaign",
    fields: "spend,impressions,clicks,actions,action_values",
    time_range: JSON.stringify({ since, until: until ?? today() }),
    limit: "500",
  };
  if (campaignIds && campaignIds.length > 0) {
    params.filtering = JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }]);
  }
  const rows = await graphGetAll<MetaInsightRow>(`act_${accountExternalId}/insights`, token.accessToken, params, 20);
  return rows.reduce<ScopeInsights>((acc, r) => {
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
  const params: Record<string, string> = {
    level: "ad",
    fields: "ad_id,ad_name,spend",
    // until defaults to today so a plain since-only call (a preset window) is unchanged;
    // an explicit range passes both bounds.
    time_range: JSON.stringify({ since, until: until ?? today() }),
    sort: "spend_descending",
    limit: String(limit),
  };
  if (campaignIds && campaignIds.length > 0) {
    params.filtering = JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }]);
  }
  const data = await graphGet<{ data: { ad_id: string; ad_name?: string }[] }>(
    `act_${accountExternalId}/insights`,
    token.accessToken,
    params,
  );
  return (data.data ?? []).map((r) => ({ externalId: r.ad_id, name: r.ad_name ?? r.ad_id }));
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
  >(`act_${accountExternalId}/insights`, token.accessToken, params);
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
