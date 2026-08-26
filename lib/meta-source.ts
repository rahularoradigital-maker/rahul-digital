// Meta implementation of the AdSource interface (ADR-0002). Real Graph API calls
// (Marketing API v21) against a connected user's token. No Claude/MCP anywhere:
// this runs inside the deployed app with the END USER's own OAuth token.
// Pure data-fetching; scoring/verdicts happen in the rules engine, not here.

import type { AdSource, TokenSet, SourceAd, MetricsRow } from "./ad-source.ts";

const GRAPH = "https://graph.facebook.com/v21.0";

type MetaAdAccount = { account_id: string; name?: string };
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
  const res = await fetch(url.toString());
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Meta Graph ${res.status} on ${path}: ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

const PURCHASE = "offsite_conversion.fct_purchase";
function sumAction(list: MetaInsightAction[] | undefined, type: string): number {
  if (!list) return 0;
  return list.filter((a) => a.action_type === type).reduce((acc, a) => acc + Number(a.value || 0), 0);
}

export const metaSource: AdSource = {
  platform: "meta",

  async listAds(accountExternalId: string, token: TokenSet): Promise<SourceAd[]> {
    // accountExternalId is the numeric Meta ad account id (without the act_ prefix).
    // Large accounts return thousands of ads; requesting 200 with nested creative
    // expansion makes Meta reject the call with "reduce the amount of data" (code 1).
    // Ask only for the fields we use, cap the page small, and bias to ACTIVE ads
    // (the ones a weekly decision cares about, and the ones most likely to have spend).
    const data = await graphGet<{ data: MetaAd[] }>(`act_${accountExternalId}/ads`, token.accessToken, {
      fields: "id,name,effective_status",
      effective_status: '["ACTIVE"]',
      limit: "25",
    });
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
      purchases: sumAction(row.actions, PURCHASE),
      revenue: sumAction(row.action_values, PURCHASE),
    }));
  },

  // Meta long-lived tokens are refreshed by re-exchanging, not a refresh_token grant.
  // Left minimal until the sync scheduler needs it.
  async refreshToken(_refreshToken: string): Promise<TokenSet> {
    throw new Error("Meta uses long-lived token exchange, not refresh_token grant");
  },
};

/** List the ad accounts the connected user can access (for the account picker). */
export async function listMetaAdAccounts(token: TokenSet): Promise<{ externalId: string; name: string }[]> {
  const data = await graphGet<{ data: MetaAdAccount[] }>("me/adaccounts", token.accessToken, {
    fields: "account_id,name",
    limit: "200",
  });
  return (data.data ?? []).map((a) => ({ externalId: a.account_id, name: a.name ?? a.account_id }));
}

function today(): string {
  // ponytail: date-only string for Graph's time_range. Uses the server clock at call time.
  return new Date().toISOString().slice(0, 10);
}
