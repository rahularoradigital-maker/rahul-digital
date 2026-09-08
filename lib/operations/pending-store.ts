import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/security/audit-log";
import { canTransition, initialStatus, auditVerb, type PendingStatus } from "./approval.ts";
import type { Operation } from "./types.ts";
import type { ValidationResult } from "./validate.ts";

// Pending-operations store (A5). Service-role, user_id-scoped (RLS default-deny table). Every state change is
// audited (A5 rule: no silent transitions), and a transition is refused unless the pure state machine allows
// it and the caller owns the row (owner = approver for the single-tenant beta; an org role can gate this later).

export type PendingRow = {
  id: string;
  kind: string;
  status: PendingStatus;
  operation: Operation;
  validation: ValidationResult | null;
  dispatch: Record<string, unknown> | null;
  createdAt: string;
  decidedAt: string | null;
};

function toRow(r: Record<string, unknown>): PendingRow {
  return {
    id: String(r.id),
    kind: String(r.kind),
    status: r.status as PendingStatus,
    operation: r.operation as Operation,
    validation: (r.validation as ValidationResult) ?? null,
    dispatch: (r.dispatch as Record<string, unknown>) ?? null,
    createdAt: String(r.created_at),
    decidedAt: r.decided_at ? String(r.decided_at) : null,
  };
}

// Persist a submitted operation as a pending row IF it is a real action to decide (validated -> ready, or
// blocked -> shown so the user sees why). A read (not_applicable) is never queued; returns null.
export async function createPending(
  userId: string,
  account: string,
  operation: Operation,
  validation: ValidationResult,
  dispatch: Record<string, unknown> | null,
): Promise<PendingRow | null> {
  const status = initialStatus(validation);
  if (!status) return null;
  const { data, error } = await createAdminClient()
    .from("pending_operations")
    .insert({ user_id: userId, account_external_id: account, kind: operation.kind, status, operation, validation, dispatch })
    .select("*")
    .single();
  if (error || !data) {
    console.warn("[pending] create failed:", error?.message);
    return null;
  }
  await recordAudit({ action: "operation.submit", actorId: userId, targetType: "pending_operation", targetId: String(data.id), result: "ok", reason: `${operation.kind} -> ${status}` });
  return toRow(data);
}

export async function listPending(userId: string, limit = 50): Promise<PendingRow[]> {
  const { data } = await createAdminClient()
    .from("pending_operations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(toRow);
}

export type TransitionResult = { ok: true; row: PendingRow } | { ok: false; error: string };

// Move a pending op to `to`, but only when the pure machine allows it AND the caller owns the row. Audited.
export async function transitionPending(userId: string, id: string, to: PendingStatus, reason?: string): Promise<TransitionResult> {
  const admin = createAdminClient();
  const { data: cur } = await admin.from("pending_operations").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
  if (!cur) return { ok: false, error: "Not found." };
  const from = cur.status as PendingStatus;
  if (!canTransition(from, to)) {
    await recordAudit({ action: auditVerb(to), actorId: userId, targetType: "pending_operation", targetId: id, result: "denied", reason: `illegal ${from} -> ${to}` });
    return { ok: false, error: `Cannot move a "${from}" operation to "${to}".` };
  }
  const { data, error } = await admin
    .from("pending_operations")
    .update({ status: to, decided_by: userId, decided_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Update failed." };
  await recordAudit({ action: auditVerb(to), actorId: userId, targetType: "pending_operation", targetId: id, result: "ok", reason: reason ?? `${from} -> ${to}`, approval: { approvedBy: userId } });
  return { ok: true, row: toRow(data) };
}
