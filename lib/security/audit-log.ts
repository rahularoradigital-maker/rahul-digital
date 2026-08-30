import "server-only";
import { createAdminClient } from "../supabase/admin.ts";
import { buildAuditRow, type AuditEntry } from "./audit-row.ts";

export type { AuditAction, AuditEntry } from "./audit-row.ts";

// The server-only writer for the audit spine. Pure serialization + redaction live in audit-row.ts; this file
// only performs the write. Best-effort: never throws into the caller (a failed audit must not break the
// underlying action) but never fails silently either - a write error is logged for ops. No-ops cleanly until
// 0015_audit_log.sql is applied (table-missing just becomes a logged failure). The DB enforces append-only.

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_log").insert(buildAuditRow(entry));
    if (error) console.warn(`[audit] failed to record ${entry.action}: ${error.message}`);
  } catch (err) {
    console.warn(`[audit] failed to record ${entry.action}:`, err instanceof Error ? err.message : err);
  }
}
