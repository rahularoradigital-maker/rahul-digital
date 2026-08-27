// Meta implementation of the AdSource interface (ADR-0002). Real Graph API calls
// (Marketing API v21) against a connected user's token. No Claude/MCP anywhere:
// this runs inside the deployed app with the END USER's own OAuth token.
// Pure data-fetching; scoring/verdicts happen in the rules engine, not here.

import type { AdSource, TokenSet, SourceAd, MetricsRow } from "./ad-source.ts";
import type { Objective } from "./rules/comparator.ts";

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
async function graphGet<T>(path: string, token: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Caching is handled one level up by unstable_cache around the whole cockpit fetch
  // (revalidated on switch / Re-scan), so the raw call stays a plain uncached request.
  const res = await fetch(url.toString());
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Meta Graph ${res.status} on ${path}: ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
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
  const data = await graphGet<{
    data: (MetaInsightRow & {
      ad_id: string;
      objective?: string;
      campaign_id?: string;
      adset_id?: string;
      video_play_actions?: MetaInsightAction[];
      video_thruplay_watched_actions?: MetaInsightAction[];
      outbound_clicks?: MetaInsightAction[];
    })[];
  }>(`act_${accountExternalId}/insights`, token.accessToken, params);
  for (const row of data.data ?? []) {
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
