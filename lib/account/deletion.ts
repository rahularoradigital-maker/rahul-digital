import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paged";
import { revokeToken } from "@/lib/oauth-store";
import { recordAudit } from "@/lib/security/audit-log";
import { GRACE_PERIOD_DAYS } from "./deletion-manifest";
import { buildPurgePlan, type PurgeStep } from "./purge-plan";
export { buildPurgePlan, type PurgeStep } from "./purge-plan";

// The account-deletion EXECUTOR (the manifest is the spec; this runs it). Rahul's decisions (2026-09-01):
// self-serve, SOFT-delete with a 14-day grace, revoke Meta now, Cancel aborts. Nothing is hard-deleted at
// request time - a request only schedules the purge; the cron (app/api/cron/purge-deletions) runs the actual
// executor once the grace has elapsed. The purge order is derived from the manifest so coverage is correct-by-
// construction and provable offline (buildPurgePlan + scripts/check-account-purge.ts), never a hand-kept list.

export type DeletionStatus = "pending" | "cancelled" | "purged";
export type PendingDeletion = { userId: string; status: DeletionStatus; requestedAt: string; purgeAfter: string };

// Schedule deletion (soft): record the request + grace deadline and revoke Meta access NOW (best-effort), so
// the account stops syncing immediately even though the data purge waits out the grace. Idempotent: a repeat
// request just refreshes the pending row. Returns the purge date for the UI to show.
export async function requestAccountDeletion(userId: string, reason?: string): Promise<{ ok: true; purgeAfter: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const purgeAfter = new Date(Date.now() + GRACE_PERIOD_DAYS * 86_400_000).toISOString();
  const { error } = await admin
    .from("account_deletions")
    .upsert({ user_id: userId, status: "pending", requested_at: new Date().toISOString(), purge_after: purgeAfter, purged_at: null, reason: reason ?? null }, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };
  // Revoke external access now (best-effort). A failure downgrades to "revoke pending" - the final purge
  // re-attempts it - and must NOT block scheduling the deletion.
  await revokeUserExternals(userId).catch(() => {});
  await recordAudit({ action: "account.delete_requested", actorId: userId, targetType: "user", targetId: userId, result: "ok", reason: `grace ${GRACE_PERIOD_DAYS}d, purge_after ${purgeAfter}` });
  return { ok: true, purgeAfter };
}

// Abort a pending deletion (the Cancel button, or a re-login flow). Only a still-pending row can be cancelled.
export async function cancelAccountDeletion(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_deletions")
    .update({ status: "cancelled" })
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("user_id");
  const cancelled = !error && (data?.length ?? 0) > 0;
  if (cancelled) await recordAudit({ action: "account.delete_cancelled", actorId: userId, targetType: "user", targetId: userId, result: "ok", reason: "within grace" });
  return cancelled;
}

// The pending deletion for a user (for the /app banner), or null. Never throws.
export async function getPendingDeletion(userId: string): Promise<PendingDeletion | null> {
  try {
    const { data } = await createAdminClient()
      .from("account_deletions")
      .select("user_id,status,requested_at,purge_after")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();
    if (!data) return null;
    return { userId: data.user_id as string, status: data.status as DeletionStatus, requestedAt: data.requested_at as string, purgeAfter: data.purge_after as string };
  } catch {
    return null;
  }
}

// Revoke every external credential this user holds (Meta OAuth tokens, one per connected ad account). Called
// at request time and again inside the purge (idempotent - revokeToken deletes the local row + is audited).
async function revokeUserExternals(userId: string): Promise<void> {
  const admin = createAdminClient();
  // Paged (S0): ad_accounts is a >1,000-cap table in the lint; an agency user could hold many. order by id.
  const rows = await readAllPages<{ id: string }>((from, to) =>
    admin.from("ad_accounts").select("id").eq("user_id", userId).order("id", { ascending: true }).range(from, to),
  ).catch(() => [] as { id: string }[]);
  for (const row of rows) {
    await revokeToken(row.id, userId).catch(() => {}); // best-effort; downgrade to revoke-pending on failure
  }
}

// Execute the purge plan for one account. dryRun returns the plan WITHOUT touching any data (used by the
// self-check to prove coverage offline). A real run deletes by user_id in manifest order and finishes with the
// auth-user delete, which cascades SET A. Best-effort per step + audited; the auth delete is the point of no
// return, so it runs last and only after the local rows are gone.
export async function purgeAccount(userId: string, opts: { dryRun?: boolean } = {}): Promise<{ ok: boolean; plan: PurgeStep[]; error?: string }> {
  const plan = buildPurgePlan();
  if (opts.dryRun) return { ok: true, plan };

  const admin = createAdminClient();
  try {
    for (const step of plan) {
      if (step.kind === "revoke") {
        if (step.target === "meta") await revokeUserExternals(userId);
        // (shopify uninstall is a no-op today - no live Shopify OAuth; the local rows are deleted below.)
      } else if (step.kind === "delete") {
        const { error } = await admin.from(step.target).delete().eq("user_id", userId);
        if (error) throw new Error(`delete ${step.target}: ${error.message}`);
      } else if (step.kind === "anonymize") {
        // Null this user's link on retained rows (audit_log actor_id, owner_events user_id). Best-effort:
        // owner_events already `on delete set null`; audit_log is anonymized here for the compliance trail.
        if (step.target === "audit_log") await admin.from("audit_log").update({ actor_id: null }).eq("actor_id", userId).then(undefined, () => {});
      } else if (step.kind === "auth-delete") {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw new Error(`auth delete: ${error.message}`);
      }
    }
    // The account_deletions row cascades away with the auth user, so there is nothing left to mark; the audit
    // trail (below) is the durable record that the purge completed.
    await recordAudit({ action: "account.purged", actorId: null, targetType: "user", targetId: userId, result: "ok", reason: `purged ${plan.filter((s) => s.kind === "delete").length} tables + auth user` });
    return { ok: true, plan };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "purge failed";
    await recordAudit({ action: "account.purge_failed", actorId: null, targetType: "user", targetId: userId, result: "error", reason: msg }).catch(() => {});
    return { ok: false, plan, error: msg };
  }
}

// Cron body: purge every account whose grace has elapsed. Bounded per run so one cron tick can't run forever;
// remaining accounts are picked up on the next tick. Returns a small summary for the route to report.
export async function purgeExpiredDeletions(limit = 25): Promise<{ due: number; purged: number; failed: number }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("account_deletions")
    .select("user_id")
    .eq("status", "pending")
    .lte("purge_after", new Date().toISOString())
    .order("purge_after", { ascending: true })
    .limit(limit);
  const due = (data ?? []) as { user_id: string }[];
  let purged = 0;
  let failed = 0;
  for (const row of due) {
    const res = await purgeAccount(row.user_id);
    if (res.ok) purged++;
    else failed++;
  }
  return { due: due.length, purged, failed };
}
