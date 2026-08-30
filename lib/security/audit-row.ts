// Pure core of the audit spine: types + secret-scrubbing + row serializer. NO I/O, NO server-only, so it is
// unit-testable without a database (scripts/check-audit-log.ts). The server-only writer lib/security/audit-log.ts
// imports buildAuditRow from here. Two invariants live here: secrets never survive into a row, and the row
// shape is complete + defaulted. The DB enforces append-only immutability (0015_audit_log.sql).

export type AuditAction =
  | "credential.store"
  | "credential.rotate"
  | "credential.revoke"
  | "credits.grant"
  | "credits.revoke"
  | "billing.refund"
  | "rule.publish"
  | "prompt.publish"
  | "killswitch.execute"
  | "feature_flag.change"
  | "user.suspend"
  | "data.export"
  | "account.delete"
  | "judgment.label" // operator approves/dismisses a recommendation (RLEF)
  | (string & {}); // extensible: any dotted verb, without losing autocomplete on the known ones

export type AuditEntry = {
  action: AuditAction;
  actorId?: string | null;
  actorRole?: string | null;
  orgId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  result?: "ok" | "denied" | "error";
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  approval?: { initiatedBy?: string; approvedBy?: string; [k: string]: unknown } | null;
};

// A key whose NAME suggests a secret - its value is dropped from any state snapshot before it is stored.
const SECRET_KEY = /(secret|token|password|passwd|api[_-]?key|authorization|cookie|refresh|access[_-]?token|private[_-]?key|encrypted|cvv|card)/i;
const REDACTED = "[redacted]";

// Recursively strip secret-shaped fields from a state object so an audit row can never become a leak vector.
export function scrub(value: unknown, depth = 0): unknown {
  if (value == null || depth > 6) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? REDACTED : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

// Pure: turn a typed entry into the exact snake_case DB row.
export function buildAuditRow(e: AuditEntry): Record<string, unknown> {
  return {
    actor_id: e.actorId ?? null,
    actor_role: e.actorRole ?? null,
    org_id: e.orgId ?? null,
    action: e.action,
    target_type: e.targetType ?? null,
    target_id: e.targetId ?? null,
    before_state: e.before === undefined ? null : scrub(e.before),
    after_state: e.after === undefined ? null : scrub(e.after),
    reason: e.reason ?? null,
    result: e.result ?? "ok",
    request_id: e.requestId ?? null,
    ip: e.ip ?? null,
    user_agent: e.userAgent ?? null,
    approval: e.approval ?? null,
  };
}
