import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paged";
import { computeScopes, type ReconAd, type ReconReport } from "@/lib/reconcile/scopes";
import { rollupHeadline, isRollupFresh, buildRollupRecon, ROLLUP_WINDOW_DAYS } from "@/lib/rollups/pure";
import type { ReconSummary } from "@/lib/intelligence/reconcile";

// 10x lever #5 "Instant app": the whole-account scope aggregate is expensive (scan every ad_metrics row in a
// 90-day window + ad_meta for status) and was recomputed on every reconcile / headline read. Here it is
// computed ONCE when a sync completes and stored in account_rollups; reads become a single-row fetch. The
// math is the SAME pure computeScopes() the reconcile page already uses (so numbers are identical), just
// moved off the request path. A page still falls back to a live scan when no fresh rollup exists, then saves
// what it computed (self-heal), so the feature degrades safely and never shows an empty screen. Pure helpers
// (rollupHeadline / isRollupFresh) live in ./pure so the check can import them without server-only.

export { ROLLUP_WINDOW_DAYS } from "@/lib/rollups/pure";

export type AccountRollup = { report: ReconReport; spend: number; revenue: number; purchases: number; ads: number; computedAt: string };

// Read the store for the window and build the ReconAd[] the scopes are computed from. Same source + shape as
// lib/reconcile/store.ts, so computeScopes() over it produces the identical report.
async function computeReport(userId: string, account: string, windowDays: number): Promise<{ report: ReconReport; purchases: number } | null> {
  const admin = createAdminClient();
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);

  let metricRows: { ad_id: string; spend: number; revenue: number; purchases: number }[] = [];
  try {
    metricRows = await readAllPages((from, to) =>
      admin.from("ad_metrics").select("ad_id,spend,revenue,purchases").eq("user_id", userId).eq("account_external_id", account).gte("date", since).lte("date", until).order("ad_id", { ascending: true }).order("date", { ascending: true }).range(from, to),
    );
  } catch {
    return null; // store unreadable -> no rollup (the caller keeps its own fallback)
  }
  if (!metricRows.length) return null;

  const perAd = new Map<string, { spend: number; revenue: number; purchases: number }>();
  for (const r of metricRows) {
    const a = perAd.get(r.ad_id) ?? { spend: 0, revenue: 0, purchases: 0 };
    a.spend += r.spend ?? 0;
    a.revenue += r.revenue ?? 0;
    a.purchases += r.purchases ?? 0;
    perAd.set(r.ad_id, a);
  }

  const metaByAd = new Map<string, { active: boolean | null; catalog: boolean }>();
  try {
    const metaRows = await readAllPages<{ ad_id: string; effective_status: string | null; is_catalog: boolean | null }>((from, to) =>
      admin.from("ad_meta").select("ad_id,effective_status,is_catalog").eq("user_id", userId).eq("account_external_id", account).order("ad_id", { ascending: true }).range(from, to),
    );
    for (const m of metaRows) metaByAd.set(m.ad_id, { active: m.effective_status == null ? null : m.effective_status === "ACTIVE", catalog: !!m.is_catalog });
  } catch {
    // status/catalog optional (matches loadReconcile): those scopes just fall back to unknown
  }

  const ads: ReconAd[] = [...perAd].map(([adId, m]) => {
    const meta = metaByAd.get(adId);
    return { spend: m.spend, revenue: m.revenue, purchases: m.purchases, active: meta ? meta.active : null, catalog: meta?.catalog ?? false };
  });
  let purchases = 0;
  for (const a of ads) purchases += a.purchases;
  return { report: computeScopes(ads), purchases };
}

// Compute + store the rollup. Called off the request path when a sync completes. Best-effort: returns false on
// any failure so a sync never breaks on it.
export async function refreshAccountRollup(userId: string, account: string, windowDays: number = ROLLUP_WINDOW_DAYS): Promise<boolean> {
  const c = await computeReport(userId, account, windowDays);
  if (!c) return false;
  return saveAccountReport(userId, account, windowDays, c.report, c.purchases);
}

// Persist an already-computed report (also the self-heal path: a page that had to scan saves what it built).
export async function saveAccountReport(userId: string, account: string, windowDays: number, report: ReconReport, purchases: number): Promise<boolean> {
  const h = rollupHeadline(report);
  const { error } = await createAdminClient()
    .from("account_rollups")
    .upsert(
      { user_id: userId, account_external_id: account, window_days: windowDays, report, spend: h.spend, revenue: h.revenue, purchases, ads: h.ads, computed_at: new Date().toISOString() },
      { onConflict: "user_id,account_external_id,window_days" },
    );
  return !error;
}

// Read a FRESH rollup, or null (missing / stale / error) so the caller falls back to a live scan.
export async function loadAccountRollup(userId: string, account: string, windowDays: number = ROLLUP_WINDOW_DAYS, opts: { maxAgeMs?: number } = {}): Promise<AccountRollup | null> {
  const { data } = await createAdminClient()
    .from("account_rollups")
    .select("report,spend,revenue,purchases,ads,computed_at")
    .eq("user_id", userId)
    .eq("account_external_id", account)
    .eq("window_days", windowDays)
    .maybeSingle();
  if (!data) return null;
  const row = data as { report: ReconReport; spend: number; revenue: number; purchases: number; ads: number; computed_at: string };
  if (!isRollupFresh(row.computed_at, Date.now(), opts.maxAgeMs ?? undefined)) return null;
  return { report: row.report, spend: row.spend, revenue: row.revenue, purchases: row.purchases, ads: row.ads, computedAt: row.computed_at };
}

export type RollupVerification = { computedAt: string; fresh: boolean; drift: ReconSummary; notes: string[] } | null;

// Self-proving check (10x #5 → #1): compare the STORED rollup headline against a FRESH recompute from the
// store right now, and return f3's reconcile verdict. `drift.trustworthy=false` means the store moved since
// the rollup was written (stale - a refresh is due) or a compute bug. Returns null when there is no stored
// rollup or the store is unreadable. Reads the store, so it is on-demand only (e.g. summary?verify=1), never
// on the hot path.
export async function verifyAccountRollup(userId: string, account: string, windowDays: number = ROLLUP_WINDOW_DAYS): Promise<RollupVerification> {
  const { data } = await createAdminClient()
    .from("account_rollups")
    .select("report,computed_at")
    .eq("user_id", userId)
    .eq("account_external_id", account)
    .eq("window_days", windowDays)
    .maybeSingle();
  if (!data) return null;
  const stored = data as { report: ReconReport; computed_at: string };
  const c = await computeReport(userId, account, windowDays);
  if (!c) return null;
  const { recs, summary } = buildRollupRecon(rollupHeadline(stored.report), rollupHeadline(c.report));
  return { computedAt: stored.computed_at, fresh: isRollupFresh(stored.computed_at, Date.now()), drift: summary, notes: recs.map((r) => r.note) };
}
