import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Persistence for the store-vs-Meta accuracy log (10x #1). Append-only; both calls are best-effort so a
// logging hiccup never breaks the verify response. The pure streak/status helpers live in ./pure.

export type VerificationRow = {
  windowDays: number;
  spendStore: number;
  spendMeta: number;
  revenueStore: number;
  revenueMeta: number;
  worstDriftPct: number;
  status: string;
  trustworthy: boolean;
  createdAt: string;
};

export async function recordVerification(
  userId: string,
  account: string,
  row: Omit<VerificationRow, "createdAt">,
): Promise<void> {
  await createAdminClient()
    .from("account_verifications")
    .insert({
      user_id: userId,
      account_external_id: account,
      window_days: row.windowDays,
      spend_store: row.spendStore,
      spend_meta: row.spendMeta,
      revenue_store: row.revenueStore,
      revenue_meta: row.revenueMeta,
      worst_drift_pct: row.worstDriftPct,
      status: row.status,
      trustworthy: row.trustworthy,
    })
    .then(undefined, () => {}); // best-effort: never fail the verify response over the log write
}

// Most-recent verifications for an account, newest first (for the clean-streak + trend).
export async function loadVerificationHistory(userId: string, account: string, limit = 10): Promise<VerificationRow[]> {
  const { data } = await createAdminClient()
    .from("account_verifications")
    .select("window_days,spend_store,spend_meta,revenue_store,revenue_meta,worst_drift_pct,status,trustworthy,created_at")
    .eq("user_id", userId)
    .eq("account_external_id", account)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    windowDays: Number(r.window_days),
    spendStore: Number(r.spend_store),
    spendMeta: Number(r.spend_meta),
    revenueStore: Number(r.revenue_store),
    revenueMeta: Number(r.revenue_meta),
    worstDriftPct: Number(r.worst_drift_pct),
    status: String(r.status),
    trustworthy: Boolean(r.trustworthy),
    createdAt: String(r.created_at),
  }));
}
