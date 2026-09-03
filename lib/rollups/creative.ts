import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paged";
import { topCreatives, classifyCreatives, type CreativeAgg, DEFAULT_TOP_N } from "@/lib/rollups/creative-pure";
import { ROLLUP_WINDOW_DAYS, isRollupFresh } from "@/lib/rollups/pure";

// 10x #5 instant-app: the top creatives (by spend) for an account, precomputed so the Creative page / Studio
// recommendations read a single row instead of scanning ad_metrics. Sibling of lib/rollups/account.ts; the
// pure ranking lives in ./creative-pure so the check can import it without server-only.

export type CreativeRollup = { top: CreativeAgg[]; count: number; computedAt: string };

// Aggregate ad_metrics per ad (whole-account, window) + names/status from ad_meta, rank by spend, keep top N.
async function computeCreatives(userId: string, account: string, windowDays: number): Promise<{ top: CreativeAgg[]; count: number } | null> {
  const admin = createAdminClient();
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);

  let rows: { ad_id: string; spend: number; revenue: number; purchases: number }[] = [];
  try {
    rows = await readAllPages((from, to) =>
      admin.from("ad_metrics").select("ad_id,spend,revenue,purchases").eq("user_id", userId).eq("account_external_id", account).gte("date", since).lte("date", until).order("ad_id", { ascending: true }).order("date", { ascending: true }).range(from, to),
    );
  } catch {
    return null;
  }
  if (!rows.length) return null;

  const per = new Map<string, { spend: number; revenue: number; purchases: number }>();
  for (const r of rows) {
    const a = per.get(r.ad_id) ?? { spend: 0, revenue: 0, purchases: 0 };
    a.spend += r.spend ?? 0;
    a.revenue += r.revenue ?? 0;
    a.purchases += r.purchases ?? 0;
    per.set(r.ad_id, a);
  }

  const meta = new Map<string, { name: string | null; active: boolean | null }>();
  try {
    const metaRows = await readAllPages<{ ad_id: string; name: string | null; effective_status: string | null }>((from, to) =>
      admin.from("ad_meta").select("ad_id,name,effective_status").eq("user_id", userId).eq("account_external_id", account).order("ad_id", { ascending: true }).range(from, to),
    );
    for (const m of metaRows) meta.set(m.ad_id, { name: m.name, active: m.effective_status == null ? null : m.effective_status === "ACTIVE" });
  } catch {
    // names/status optional
  }

  const aggs: CreativeAgg[] = [...per].map(([adId, m]) => ({
    adId,
    name: meta.get(adId)?.name ?? adId,
    spend: m.spend,
    revenue: m.revenue,
    purchases: m.purchases,
    roas: m.spend > 0 ? m.revenue / m.spend : null,
    active: meta.get(adId)?.active ?? null,
  }));
  // Flag each ad against the account's own average ROAS, then keep the top N by spend (flags ride along).
  return { top: topCreatives(classifyCreatives(aggs), DEFAULT_TOP_N), count: aggs.length };
}

export async function refreshCreativeRollup(userId: string, account: string, windowDays: number = ROLLUP_WINDOW_DAYS): Promise<boolean> {
  const c = await computeCreatives(userId, account, windowDays);
  if (!c) return false;
  const { error } = await createAdminClient()
    .from("creative_rollups")
    .upsert({ user_id: userId, account_external_id: account, window_days: windowDays, top: c.top, count: c.count, computed_at: new Date().toISOString() }, { onConflict: "user_id,account_external_id,window_days" });
  return !error;
}

// Read a FRESH creative rollup, or null (missing / stale / error) so the caller can self-heal via a compute.
export async function loadCreativeRollup(userId: string, account: string, windowDays: number = ROLLUP_WINDOW_DAYS, opts: { maxAgeMs?: number } = {}): Promise<CreativeRollup | null> {
  const { data } = await createAdminClient()
    .from("creative_rollups")
    .select("top,count,computed_at")
    .eq("user_id", userId)
    .eq("account_external_id", account)
    .eq("window_days", windowDays)
    .maybeSingle();
  if (!data) return null;
  const row = data as { top: CreativeAgg[]; count: number; computed_at: string };
  if (!isRollupFresh(row.computed_at, Date.now(), opts.maxAgeMs ?? undefined)) return null;
  return { top: row.top, count: row.count, computedAt: row.computed_at };
}
