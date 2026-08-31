// Google Ads implementation of the AdSource interface (ADR-0002). Kept SEPARATE from Meta for now (merged
// later). Stub-first + provider-independent, mirroring the Creative Studio image provider: with no Google
// Ads API credentials it returns deterministic DEMO data so the whole platform-selector flow is testable
// end-to-end today; when GOOGLE_ADS_DEVELOPER_TOKEN (+ an OAuth client) is configured, the real Graph-style
// GAQL client lands here with ZERO change to the cockpit/funnel/actions (they read the vendor-independent
// AdSource + the store). Relative imports + no server-only so scripts/check-google-ads-source.ts can load it.
import type { AdSource, TokenSet, SourceAd, MetricsRow } from "./ad-source.ts";

// True once the real Google Ads API is wired (needs an approved developer token + OAuth client). Until then
// the source runs in DEMO mode. Read at call time so enabling it never needs a redeploy of this module.
export function isGoogleAdsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_DEVELOPER_TOKEN.trim());
}

// Deterministic pseudo-number from a string seed (no Math.random, so demo data is stable + gate-testable).
function seed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295; // 0..1
}

// A small, stable set of demo Google ads for an account (DEMO mode only).
function demoAds(accountExternalId: string): SourceAd[] {
  return Array.from({ length: 8 }, (_, i) => {
    const id = `g_${accountExternalId}_${i + 1}`;
    return { externalId: id, name: `Google Search Ad ${i + 1}`, mediaType: "unknown" as const, status: "ACTIVE" };
  });
}

// Deterministic daily metrics for one demo ad from `since` to today. Google has no video/funnel-step actions
// in this shape, so those stay 0 (absent) - the funnel engine reads them as 0, honestly.
function demoMetrics(adExternalId: string, since: string): MetricsRow[] {
  const start = new Date(`${since}T00:00:00Z`).getTime();
  const today = new Date().setUTCHours(0, 0, 0, 0);
  const rows: MetricsRow[] = [];
  for (let t = start; t <= today; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    const r = seed(`${adExternalId}:${date}`);
    const impressions = Math.round(400 + r * 4000);
    const clicks = Math.round(impressions * (0.01 + r * 0.04));
    const spend = Math.round(clicks * (8 + r * 20));
    const purchases = Math.round(clicks * (0.01 + r * 0.03));
    rows.push({
      adExternalId, date, spend, impressions, clicks,
      purchases, revenue: Math.round(purchases * (900 + r * 2000)),
      frequency: 1 + r, outboundClicks: clicks, landingPageViews: Math.round(clicks * 0.9),
    });
  }
  return rows;
}

export const googleAdsSource: AdSource = {
  platform: "google",

  async listAds(accountExternalId: string, _token: TokenSet, _campaignId?: string): Promise<SourceAd[]> {
    if (!isGoogleAdsConfigured()) return demoAds(accountExternalId);
    // TODO(real): GAQL `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status FROM ad_group_ad`
    // via the Google Ads REST API using the developer token + OAuth access token. Same SourceAd shape out.
    throw new Error("Google Ads live client not implemented yet (developer token present but client pending).");
  },

  async fetchMetrics(adExternalId: string, since: string, _token: TokenSet): Promise<MetricsRow[]> {
    if (!isGoogleAdsConfigured()) return demoMetrics(adExternalId, since);
    // TODO(real): GAQL `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions,
    // metrics.conversions_value, segments.date FROM ad_group_ad WHERE segments.date >= since`. Map cost_micros
    // /1e6 -> spend, conversions -> purchases, conversions_value -> revenue. Same MetricsRow shape out.
    throw new Error("Google Ads live client not implemented yet (developer token present but client pending).");
  },

  async refreshToken(_refreshToken: string): Promise<TokenSet> {
    if (!isGoogleAdsConfigured()) return { accessToken: "demo-google-token" };
    // TODO(real): POST oauth2.googleapis.com/token with client_id/secret + refresh_token grant.
    throw new Error("Google Ads OAuth refresh not implemented yet.");
  },
};
