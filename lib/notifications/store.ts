import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { humanizeError } from "./humanize.ts";

// Per-user Notification Center store. Writes/reads via the service-role admin client (notifications is
// RLS deny-by-default) and ALWAYS scopes reads by user_id - the same tenant-isolation discipline the rest
// of the app uses. Best-effort: a notification write must never break the task it is reporting on.

export type NotifStatus = "running" | "success" | "error" | "info" | "warning";

export type NewNotification = {
  userId: string;
  kind: string; // 'sync' | 'ingestion' | 'analysis' | 'competitor' | 'auth' | 'system'
  status: NotifStatus;
  title: string;
  detail?: string | null;
  action?: string | null;
  orgId?: string | null;
  brandId?: string | null;
  context?: Record<string, unknown> | null;
  dedupeKey?: string | null; // set to collapse repeats of one ongoing condition (updates the row in place)
};

// Create or (when dedupeKey is set) update-in-place one notification. Never throws.
export async function notify(n: NewNotification): Promise<void> {
  const admin = createAdminClient();
  const row = {
    user_id: n.userId,
    org_id: n.orgId ?? null,
    brand_id: n.brandId ?? null,
    kind: n.kind,
    status: n.status,
    title: n.title,
    detail: n.detail ?? null,
    action: n.action ?? null,
    context: n.context ?? null,
    dedupe_key: n.dedupeKey ?? null,
    read_at: null, // a new/updated event is unread again
    updated_at: new Date().toISOString(),
  };
  const q = n.dedupeKey
    ? admin.from("notifications").upsert(row, { onConflict: "user_id,dedupe_key" })
    : admin.from("notifications").insert(row);
  await q.then(undefined, (e) => console.error("[notifications] write failed (recoverable)", e));
}

// Report a FAILURE in plain English (the "intelligent what/why" surface). Translates the raw technical
// error via humanizeError and stores it, keeping the raw text only in context for support - never as detail.
export async function notifyFailure(
  userId: string,
  kind: string,
  rawError: string | null | undefined,
  opts: { source?: string; orgId?: string | null; brandId?: string | null; dedupeKey?: string | null; context?: Record<string, unknown> } = {},
): Promise<void> {
  const h = humanizeError(rawError, opts.source);
  await notify({
    userId,
    kind,
    status: h.severity,
    title: h.title,
    detail: h.detail,
    action: h.action ?? null,
    orgId: opts.orgId ?? null,
    brandId: opts.brandId ?? null,
    dedupeKey: opts.dedupeKey ?? null,
    context: { ...(opts.context ?? {}), rawError: (rawError ?? "").slice(0, 500) }, // raw kept for support only
  });
}

export type NotificationRow = {
  id: string; kind: string; status: NotifStatus; title: string; detail: string | null;
  action: string | null; context: Record<string, unknown> | null; read_at: string | null; created_at: string; updated_at: string;
};

// The user's feed: newest first. Always scoped to their own user_id.
export async function listNotifications(userId: string, limit = 30): Promise<NotificationRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("notifications")
    .select("id, kind, status, title, detail, action, context, read_at, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as NotificationRow[];
}

// One notification by its dedupe key (or null). Used to decide whether an ongoing condition (e.g. a drift
// alarm) is currently RAISED, so it can be resolved-in-place instead of spamming a new row.
export async function getNotificationByDedupe(userId: string, dedupeKey: string): Promise<{ status: NotifStatus } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("notifications")
    .select("status")
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  return (data as { status: NotifStatus } | null) ?? null;
}

export async function unreadCount(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return count ?? 0;
}

// Mark one (by id) or all of a user's notifications read. Scoped to user_id so a forged id can't touch others'.
export async function markRead(userId: string, id?: string): Promise<void> {
  const admin = createAdminClient();
  let q = admin.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  if (id) q = q.eq("id", id);
  await q.then(undefined, () => {});
}
