import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserMetaSession } from "@/lib/meta-sync";
import { computeScopes, type ReconAd, type ReconReport } from "@/lib/reconcile/scopes";

// Reconcile-with-Meta - READ PATH. Aggregates the stored ad_metrics (spend/revenue/purchases) + ad_meta
// (status/catalog) for the active account, then computes the scope breakdown. Store-based: it needs the brand
// to have been synced (see the "only the active account is synced" note - the sync-all-accounts fix makes
// every brand available here). Returns null when the store is empty for this account+window.
const PAGE = 1000;
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
  const admin = createAdminClient();

  // Aggregate spend/revenue/purchases per ad across the window.
  const perAd = new Map<string, { spend: number; revenue: number; purchases: number }>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("ad_metrics")
      .select("ad_id,spend,revenue,purchases")
      .eq("user_id", userId)
      .eq("account_external_id", account)
      .gte("date", since)
      .lte("date", until)
      .order("ad_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return null;
    const page = (data ?? []) as { ad_id: string; spend: number; revenue: number; purchases: number }[];
    for (const r of page) {
      const a = perAd.get(r.ad_id) ?? { spend: 0, revenue: 0, purchases: 0 };
      a.spend += r.spend ?? 0;
      a.revenue += r.revenue ?? 0;
      a.purchases += r.purchases ?? 0;
      perAd.set(r.ad_id, a);
    }
    if (page.length < PAGE) break;
  }
  if (perAd.size === 0) return null;

  // Status + catalog flag per ad.
  const metaByAd = new Map<string, { active: boolean | null; catalog: boolean }>();
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("ad_meta")
      .select("ad_id,effective_status,is_catalog")
      .eq("user_id", userId)
      .eq("account_external_id", account)
      .order("ad_id", { ascending: true })
      .range(from, from + PAGE - 1);
    const page = (data ?? []) as { ad_id: string; effective_status: string | null; is_catalog: boolean | null }[];
    for (const m of page) metaByAd.set(m.ad_id, { active: m.effective_status == null ? null : m.effective_status === "ACTIVE", catalog: !!m.is_catalog });
    if (page.length < PAGE) break;
  }

  const ads: ReconAd[] = [...perAd].map(([adId, m]) => {
    const meta = metaByAd.get(adId);
    return { spend: m.spend, revenue: m.revenue, purchases: m.purchases, active: meta ? meta.active : null, catalog: meta?.catalog ?? false };
  });

  return { report: computeScopes(ads), accountName, since, until, lookbackDays };
}
