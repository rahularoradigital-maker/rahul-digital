import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paged";
import { getUserMetaSession } from "@/lib/meta-sync";
import { computeScopes, type ReconAd, type ReconReport } from "@/lib/reconcile/scopes";
import { loadAccountRollup, saveAccountReport } from "@/lib/rollups/account";

// Reconcile-with-Meta - READ PATH. Aggregates the stored ad_metrics (spend/revenue/purchases) + ad_meta
// (status/catalog) for the active account, then computes the scope breakdown. Store-based: it needs the brand
// to have been synced (see the "only the active account is synced" note - the sync-all-accounts fix makes
// every brand available here). Returns null when the store is empty for this account+window.
const DEFAULT_LOOKBACK_DAYS = 90; // reconcile is usually run against a 90-day Meta view

export type ReconBundle = { report: ReconReport; accountName: string; since: string; until: string; lookbackDays: number } | null;

export async function loadReconcile(userId: string, opts: { lookbackDays?: number } = {}): Promise<ReconBundle> {
  const session = await getUserMetaSession(userId);
  if (!session) return null;
  const account = session.activeExternalId;
  const accountName = session.activeAccountName ?? account;

  const lookbackDays = opts.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString().slice(0, 10);

  // 10x #5 instant-app fast-path: a fresh rollup (written by the sync, or self-healed below) means this page
  // reads ONE row instead of scanning the whole window. Falls through to the live scan when absent/stale.
  const rollup = await loadAccountRollup(userId, account, lookbackDays);
  if (rollup) return { report: rollup.report, accountName, since, until, lookbackDays };

  const admin = createAdminClient();

  // Aggregate spend/revenue/purchases per ad across the window.
  const perAd = new Map<string, { spend: number; revenue: number; purchases: number }>();
  let metricRows: { ad_id: string; spend: number; revenue: number; purchases: number }[] = [];
  try {
    // Parallel-burst paging; `date` secondary order makes the order total (see lib/supabase/paged.ts).
    metricRows = await readAllPages((from, to) =>
      admin
        .from("ad_metrics")
        .select("ad_id,spend,revenue,purchases")
        .eq("user_id", userId)
        .eq("account_external_id", account)
        .gte("date", since)
        .lte("date", until)
        .order("ad_id", { ascending: true })
        .order("date", { ascending: true })
        .range(from, to),
    );
  } catch {
    return null;
  }
  for (const r of metricRows) {
    const a = perAd.get(r.ad_id) ?? { spend: 0, revenue: 0, purchases: 0 };
    a.spend += r.spend ?? 0;
    a.revenue += r.revenue ?? 0;
    a.purchases += r.purchases ?? 0;
    perAd.set(r.ad_id, a);
  }
  if (perAd.size === 0) return null;

  // Status + catalog flag per ad.
  const metaByAd = new Map<string, { active: boolean | null; catalog: boolean }>();
  let metaRows: { ad_id: string; effective_status: string | null; is_catalog: boolean | null }[] = [];
  try {
    metaRows = await readAllPages((from, to) =>
      admin.from("ad_meta").select("ad_id,effective_status,is_catalog").eq("user_id", userId).eq("account_external_id", account).order("ad_id", { ascending: true }).range(from, to),
    );
  } catch {
    // was: errors ignored, page treated as empty (status/catalog become unknown)
  }
  for (const m of metaRows) metaByAd.set(m.ad_id, { active: m.effective_status == null ? null : m.effective_status === "ACTIVE", catalog: !!m.is_catalog });

  const ads: ReconAd[] = [...perAd].map(([adId, m]) => {
    const meta = metaByAd.get(adId);
    return { spend: m.spend, revenue: m.revenue, purchases: m.purchases, active: meta ? meta.active : null, catalog: meta?.catalog ?? false };
  });

  const report = computeScopes(ads);
  // Self-heal: store what we just scanned so the next load is instant, even if no sync has run yet. Best-effort
  // (fire-and-forget); a write failure never affects this response. purchases = the whole-account total.
  let purchases = 0;
  for (const a of ads) purchases += a.purchases;
  void saveAccountReport(userId, account, lookbackDays, report, purchases);
  return { report, accountName, since, until, lookbackDays };
}
