// Live sync: given a logged-in user, fetch their connected Meta account's real ads +
// metrics, run the brain, and return a cockpit view of REAL data. Server-only (reads the
// encrypted token via the service role). No dummy data anywhere in this path.

import { createAdminClient } from "./supabase/admin.ts";
import { readToken } from "./oauth-store.ts";
import { metaSource } from "./meta-source.ts";
import { toCockpitInputs, type RealAd } from "./scoring.ts";
import { analyzeAccount, type CockpitView } from "./cockpit/analyze.ts";

// v1 cost guard: how many ads to pull metrics for on a page load, and the lookback window.
// ponytail: a background sync job replaces this per-request fetch once volume grows (ADR-0004).
const MAX_ADS = 25;
const LOOKBACK_DAYS = 30;

export type LiveCockpit =
  | { status: "connected"; accountName: string; adsAnalyzed: number; view: CockpitView }
  | { status: "not_connected" }
  | { status: "error"; message: string };

export async function fetchLiveCockpit(userId: string): Promise<LiveCockpit> {
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
    const ads = await metaSource.listAds(acct.external_id, token);
    const since = daysAgo(LOOKBACK_DAYS);
    const realAds: RealAd[] = [];
    for (const ad of ads.slice(0, MAX_ADS)) {
      const rows = await metaSource.fetchMetrics(ad.externalId, since, token);
      realAds.push({ externalId: ad.externalId, name: ad.name ?? ad.externalId, rows });
    }
    // Only judge ads that actually spent in the window (J1 spend floor is applied deeper too).
    const inputs = toCockpitInputs(realAds).filter((a) => a.spendRs > 0);
    const view = analyzeAccount(inputs, "LIVE");
    return { status: "connected", accountName: acct.name ?? `act_${acct.external_id}`, adsAnalyzed: inputs.length, view };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Meta sync failed" };
  }
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
