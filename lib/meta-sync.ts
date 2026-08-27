// Live sync: given a logged-in user, fetch their connected Meta account's real ads +
// metrics, run the brain, and return a cockpit view of REAL data. Server-only (reads the
// encrypted token via the service role). No dummy data anywhere in this path.

import { after } from "next/server";
import { createAdminClient } from "./supabase/admin.ts";
import { readToken } from "./oauth-store.ts";
import { metaSource, listTopSpendingAds, fetchAdInsights, mapMetaObjective, listMetaCampaigns } from "./meta-source.ts";
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
  | { status: "connected"; accountName: string; accountExternalId: string; adsAnalyzed: number; view: CockpitView; metrics: AccountMetrics }
  | { status: "not_connected" }
  | { status: "error"; message: string };

// Resolve which campaigns to include from the active filters. undefined = no filter;
// [ids] = only these; [] = a filter that matches nothing (an objective with no active
// campaigns). The campaign picker wins; otherwise the objective picker maps to the
// account's campaigns of those objectives, so "show Conversion" selects the top ads from
// conversion campaigns instead of filtering the top-overall ads after the fact.
async function resolveCampaignIds(
  accountExternalId: string,
  token: TokenSet,
  campaignId: string | undefined,
  objectives: string[],
): Promise<string[] | undefined> {
  if (campaignId) return [campaignId];
  if (objectives.length === 0) return undefined;
  const campaigns = await listMetaCampaigns(accountExternalId, token);
  return campaigns.filter((c) => objectives.includes(mapMetaObjective(c.objective))).map((c) => c.id);
}

async function fetchLiveCockpitUncached(userId: string, lookbackDays: number = LOOKBACK_DAYS, campaignId?: string, objectives: string[] = []): Promise<LiveCockpit> {
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
    // Which campaigns to include: the campaign picker, or the objective picker mapped to
    // the account's campaigns of those objectives. undefined = all; [] = matched nothing.
    const campaignIds = await resolveCampaignIds(acct.external_id, token, campaignId, objectives);
    // Prefer the ads that actually SPENT in the window, sorted by spend (the ones that
    // matter on a big account), scoped to the resolved campaigns.
    let ads: { externalId: string; name?: string }[] = [];
    try {
      ads = await listTopSpendingAds(acct.external_id, since, token, campaignIds, MAX_ADS);
    } catch {
      ads = [];
    }
    // Only fall back to listing active ads when NO filter is active. A filter that matched
    // nothing (campaignIds === []) must stay empty, not silently show unfiltered ads.
    if (ads.length === 0 && campaignIds === undefined) {
      ads = await metaSource.listAds(acct.external_id, token);
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

    return { status: "connected", accountName: acct.name ?? `act_${acct.external_id}`, accountExternalId: acct.external_id, adsAnalyzed: inputs.length, view, metrics };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Meta sync failed" };
  }
}

// Two-level TTL cache so moving between pages reuses the computed cockpit instead of
// re-pulling the whole account (a ~9s Meta call) on every navigation. L1 is in-process
// (fast, but per serverless instance); L2 is a Supabase table shared across ALL instances,
// which is what actually fixes the "every page is slow" problem on serverless. Both are
// keyed by (userId, days, campaignId). Errors are never cached, so a failed pull retries.
// The L2 table is optional: every access is guarded, so a missing table just falls back
// to L1 + a live pull (today's behavior) rather than breaking.
type CacheEntry = { at: number; value: LiveCockpit };
// FRESH: serve straight from cache. STALE: still serve instantly, but kick off a
// background refresh so the NEXT load is fresh. Only a cache that has never been
// populated blocks on the ~9s live pull, so after the very first load a user
// effectively never waits again, on any serverless instance. The stale window is wide
// (a day) on purpose: a day-old view shown instantly while it refreshes in the
// background beats making the user watch a 9s spinner after being idle overnight.
const FRESH_MS = 300_000; // 5 minutes: serve without a background refresh
const STALE_MS = 86_400_000; // 24 hours: still serve instantly, refresh in the background
const cockpitCache = new Map<string, CacheEntry>();

/** Clear the cockpit cache. Pass userId to also clear that user's shared L2 rows. */
export async function bustCockpitCache(userId?: string): Promise<void> {
  cockpitCache.clear();
  if (!userId) return;
  try {
    const admin = createAdminClient();
    await admin.from("cockpit_cache").delete().eq("user_id", userId);
  } catch {
    // L2 unavailable; L1 is already cleared
  }
}

// Live pull, then write both cache levels. Returned to callers and also used as the
// background refresh body.
async function pullAndStore(userId: string, lookbackDays: number, campaignId: string | undefined, objectives: string[], cacheKey: string, memKey: string): Promise<LiveCockpit> {
  const value = await fetchLiveCockpitUncached(userId, lookbackDays, campaignId, objectives);
  if (value.status !== "error") {
    cockpitCache.set(memKey, { at: Date.now(), value });
    try {
      const admin = createAdminClient();
      await admin
        .from("cockpit_cache")
        .upsert({ user_id: userId, cache_key: cacheKey, data: value, updated_at: new Date().toISOString() }, { onConflict: "user_id,cache_key" });
    } catch {
      // L2 write failed; L1 still holds the value for this instance
    }
  }
  return value;
}

export async function fetchLiveCockpit(
  userId: string,
  lookbackDays: number = LOOKBACK_DAYS,
  campaignId?: string,
  objectives: string[] = [],
): Promise<LiveCockpit> {
  // Key the cache by the ACTIVE account too: without this, every account shares one
  // cache entry, so switching account keeps showing the previous account's numbers.
  const session = await getUserMetaSession(userId);
  const activeId = session?.activeExternalId ?? "none";
  const cacheKey = `${activeId}:${lookbackDays}:${campaignId ?? ""}:${[...objectives].sort().join(",")}`;
  const memKey = `${userId}:${cacheKey}`;
  const now = Date.now();

  // L1: in-process (same instance)
  const hit = cockpitCache.get(memKey);
  if (hit && now - hit.at < FRESH_MS) return hit.value;

  // L2: Supabase, shared across serverless instances
  let cached: { value: LiveCockpit; age: number } | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("cockpit_cache")
      .select("data, updated_at")
      .eq("user_id", userId)
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (data) {
      cached = { value: data.data as LiveCockpit, age: now - new Date(data.updated_at as string).getTime() };
    }
  } catch {
    // L2 unavailable; fall through to a live pull
  }

  if (cached) {
    cockpitCache.set(memKey, { at: now - cached.age, value: cached.value });
    if (cached.age < FRESH_MS) return cached.value;
    if (cached.age < STALE_MS) {
      // Serve stale immediately, refresh in the background so the next load is fresh.
      try {
        after(() => pullAndStore(userId, lookbackDays, campaignId, objectives, cacheKey, memKey));
      } catch {
        // after() unavailable outside a request scope; the stale value is still fine.
      }
      return cached.value;
    }
  }

  // Cold or too stale: block on the live pull (skeleton shows while this runs).
  return pullAndStore(userId, lookbackDays, campaignId, objectives, cacheKey, memKey);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
