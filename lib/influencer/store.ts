import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paged";
import type { BrandTarget } from "./types";
import type { RankedCreator } from "./rank";
import type { DiscoverStats } from "./discover";

// Persist + load Influencer Hunt runs. A run's ranked results are stored so the page loads instantly and we
// never re-spend provider credits on a plain page view - a re-run is an explicit action. Service-role only;
// every query is scoped by user_id in code (the tables are RLS default-deny). Snapshots are stored verbatim
// as jsonb so what we show is exactly what the engine produced at run time (with its own freshness).

export type StoredRun = { ranked: RankedCreator[]; createdAt: string; stats: DiscoverStats | null; target: BrandTarget | null };

/** Every creator's platform_user_id that has EVER appeared in a stored run for this account - i.e. everyone
 * the user has already been shown. Powers "new influencers only": on a fresh search we exclude these so the
 * user never re-sees a creator. Scoped to the account via its searches. */
export async function loadSeenCreatorIds(userId: string, accountExternalId: string): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data: searches } = await admin
    .from("influencer_search")
    .select("id")
    .eq("user_id", userId)
    .eq("account_external_id", accountExternalId);
  const searchIds = ((searches ?? []) as { id: string }[]).map((s) => s.id);
  if (searchIds.length === 0) return new Set();
  // S0 (scale): page - a single search can yield >1,000 results, and a bare select would drop some, so a
  // "new only" search could re-show already-seen creators. Order is for page stability (dupes collapse in the Set).
  const rows = await readAllPages<{ platform_user_id: string }>((f, t) =>
    admin.from("influencer_search_result").select("platform_user_id").in("search_id", searchIds).order("search_id", { ascending: true }).order("platform_user_id", { ascending: true }).range(f, t),
  ).catch(() => []);
  return new Set(rows.map((r) => r.platform_user_id));
}

/** Save one completed discovery run + its ranked results. Best-effort: a store failure must not lose the
 * results the caller already computed, so it throws and the caller decides (the run still returns to the UI). */
export async function saveDiscovery(
  userId: string,
  accountExternalId: string,
  target: BrandTarget,
  ranked: RankedCreator[],
  stats: DiscoverStats,
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("influencer_search")
    .insert({
      user_id: userId,
      account_external_id: accountExternalId,
      raw_query: stats.queries.join(", ").slice(0, 500),
      spec: { target, stats },
      status: "ready",
      results_count: ranked.length,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`influencer_search insert: ${error?.message ?? "no id"}`);
  const searchId = (data as { id: string }).id;

  if (ranked.length === 0) return;
  const rows = ranked.map((r) => ({
    search_id: searchId,
    user_id: userId,
    platform: r.creator.identity.platform,
    platform_user_id: r.creator.identity.platformUserId,
    rank: r.rank,
    scores: r, // the whole RankedCreator snapshot: creator + full scorecard + rank + topReason
    top_reason: r.topReason.slice(0, 500),
  }));
  const { error: rErr } = await admin.from("influencer_search_result").insert(rows);
  if (rErr) throw new Error(`influencer_search_result insert: ${rErr.message}`);
}

/** Load the most recent run for this account, or null if none has been run yet. */
export async function loadLatestDiscovery(userId: string, accountExternalId: string): Promise<StoredRun | null> {
  const admin = createAdminClient();
  const { data: search } = await admin
    .from("influencer_search")
    .select("id, created_at, spec")
    .eq("user_id", userId)
    .eq("account_external_id", accountExternalId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!search) return null;

  // S0 (scale): page - a run can store >1,000 ranked results and a bare select would drop the tail silently.
  const rows = await readAllPages<{ scores: RankedCreator }>((f, t) =>
    admin.from("influencer_search_result").select("scores").eq("search_id", (search as { id: string }).id).order("rank", { ascending: true }).range(f, t),
  ).catch(() => []);

  const ranked = rows.map((r) => r.scores).filter(Boolean);
  const spec = (search as { spec: { target?: BrandTarget; stats?: DiscoverStats } | null }).spec;
  return {
    ranked,
    createdAt: (search as { created_at: string }).created_at,
    stats: spec?.stats ?? null,
    target: spec?.target ?? null,
  };
}
