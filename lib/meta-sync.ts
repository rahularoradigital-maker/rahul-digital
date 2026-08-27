// Live sync: given a logged-in user, fetch their connected Meta account's real ads +
// metrics, run the brain, and return a cockpit view of REAL data. Server-only (reads the
// encrypted token via the service role). No dummy data anywhere in this path.

import { createAdminClient } from "./supabase/admin.ts";
import { readToken } from "./oauth-store.ts";
import { metaSource, listTopSpendingAds, fetchAdInsights, mapMetaObjective } from "./meta-source.ts";
import { toCockpitInputs, type RealAd } from "./scoring.ts";
import { analyzeAccount, type CockpitView } from "./cockpit/analyze.ts";
import type { TokenSet } from "./ad-source.ts";

// The user's currently-active Meta account (most-recently connected) and its token.
// One user OAuth token works across all their ad accounts, so the account picker and
// the account-switch route both read the session here. Returns null (never throws) if
// nothing is connected or the service role / DB is unavailable.
export async function getUserMetaSession(
  userId: string,
): Promise<{ token: TokenSet; activeExternalId: string; activeAccountName: string } | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ad_accounts")
      .select("id, external_id, name")
      .eq("user_id", userId)
      .eq("platform", "meta")
      .eq("status", "connected")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const token = await readToken(data.id);
    if (!token) return null;
    return { token, activeExternalId: data.external_id, activeAccountName: data.name ?? `act_${data.external_id}` };
  } catch {
    return null;
  }
}

// v1 cost guard: how many ads to pull metrics for on a page load, and the lookback window.
// ponytail: a background sync job replaces this per-request fetch once volume grows (ADR-0004).
const MAX_ADS = 25;
const LOOKBACK_DAYS = 30;

// Account-level raw metrics summed from the real day-wise rows, for KPIs the Meta
// account can answer directly (impressions, clicks, CPM, CTR, CPC, CPA). Derived
// ratios are null when the denominator is zero (never a fabricated number).
export type AccountMetrics = {
  impressions: number;
  clicks: number;
  purchases: number;
  cpm: number | null;
  ctrAll: number | null;
  cpcAll: number | null;
  cpa: number | null;
};

export type LiveCockpit =
  | { status: "connected"; accountName: string; adsAnalyzed: number; view: CockpitView; metrics: AccountMetrics }
  | { status: "not_connected" }
  | { status: "error"; message: string };

async function fetchLiveCockpitUncached(userId: string, lookbackDays: number = LOOKBACK_DAYS, campaignId?: string): Promise<LiveCockpit> {
  // createAdminClient throws if SUPABASE_SERVICE_ROLE_KEY is missing; a DB hiccup can
  // also throw. Either way the dashboard must render the Connect screen, never 500.
  let acct: { id: string; external_id: string; name: string | null } | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ad_accounts")
      .select("id, external_id, name")
      .eq("user_id", userId)
      .eq("platform", "meta")
      .eq("status", "connected")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { status: "error", message: error.message };
    acct = data;
  } catch {
    return { status: "not_connected" };
  }
  if (!acct) return { status: "not_connected" };

  let token;
  try {
    token = await readToken(acct.id);
  } catch {
    return { status: "not_connected" };
  }
  if (!token) return { status: "not_connected" };

  try {
    const since = daysAgo(lookbackDays);
    // Prefer the ads that actually SPENT in the window, sorted by spend (the ones that
    // matter on a big account). Fall back to listing active ads if the insights call
    // fails or nothing has spent yet, so the cockpit still populates.
    let ads: { externalId: string; name?: string }[] = [];
    try {
      ads = await listTopSpendingAds(acct.external_id, since, token, campaignId, MAX_ADS);
    } catch {
      ads = [];
    }
    if (ads.length === 0) {
      ads = await metaSource.listAds(acct.external_id, token, campaignId);
    }
    // Pull daily metrics for all of these ads in ONE account-level call instead of one
    // request per ad (26 round-trips -> 2). This is the main page-speed fix.
    const top = ads.slice(0, MAX_ADS);
    const rowsByAd = await fetchAdInsights(acct.external_id, top.map((a) => a.externalId), since, token);
    const realAds: RealAd[] = top.map((ad) => {
      const entry = rowsByAd.get(ad.externalId);
      return {
        externalId: ad.externalId,
        name: ad.name ?? ad.externalId,
        rows: entry?.rows ?? [],
        objective: mapMetaObjective(entry?.objective),
      };
    });
    // Only judge ads that actually spent in the window (J1 spend floor is applied deeper too).
    const inputs = toCockpitInputs(realAds).filter((a) => a.spendRs > 0);
    const view = analyzeAccount(inputs, "LIVE");

    // Sum the raw day-wise rows for account-level metrics (real numbers only).
    let sSpend = 0;
    let sImpr = 0;
    let sClicks = 0;
    let sPur = 0;
    for (const ad of realAds) {
      for (const r of ad.rows) {
        sSpend += r.spend;
        sImpr += r.impressions;
        sClicks += r.clicks;
        sPur += r.purchases;
      }
    }
    const metrics: AccountMetrics = {
      impressions: sImpr,
      clicks: sClicks,
      purchases: sPur,
      cpm: sImpr > 0 ? (sSpend / sImpr) * 1000 : null,
      ctrAll: sImpr > 0 ? (sClicks / sImpr) * 100 : null,
      cpcAll: sClicks > 0 ? sSpend / sClicks : null,
      cpa: sPur > 0 ? sSpend / sPur : null,
    };

    return { status: "connected", accountName: acct.name ?? `act_${acct.external_id}`, adsAnalyzed: inputs.length, view, metrics };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Meta sync failed" };
  }
}

// A small in-process TTL cache so moving between pages reuses the computed cockpit
// instead of re-pulling the whole account on every navigation (the "every page is slow"
// fix). Keyed by (userId, days, campaignId). Busted at once on account switch and
// Re-scan via bustCockpitCache(). Errors are not cached, so a failed pull retries.
type CacheEntry = { at: number; value: LiveCockpit };
const COCKPIT_TTL_MS = 120_000;
const cockpitCache = new Map<string, CacheEntry>();

export function bustCockpitCache(): void {
  cockpitCache.clear();
}

export async function fetchLiveCockpit(
  userId: string,
  lookbackDays: number = LOOKBACK_DAYS,
  campaignId?: string,
): Promise<LiveCockpit> {
  const key = `${userId}:${lookbackDays}:${campaignId ?? ""}`;
  const hit = cockpitCache.get(key);
  if (hit && Date.now() - hit.at < COCKPIT_TTL_MS) return hit.value;
  const value = await fetchLiveCockpitUncached(userId, lookbackDays, campaignId);
  if (value.status !== "error") cockpitCache.set(key, { at: Date.now(), value });
  return value;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
