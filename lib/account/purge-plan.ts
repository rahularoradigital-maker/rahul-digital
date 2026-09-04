// PURE (no server-only, no I/O) so the gate exercises it and the server executor imports it. The ordered plan
// for purging one account, derived from the deletion manifest so coverage is correct-by-construction.
import { EXPLICIT_DELETE_BY_USER, EXTERNAL_REVOCATIONS, RETAIN_OR_ANONYMIZE } from "./deletion-manifest.ts";

// One ordered, auditable step of a purge. `kind` groups them so the check can assert the invariants (every
// explicit-delete table present; auth-delete strictly last; revokes before the auth delete).
export type PurgeStep =
  | { kind: "revoke"; target: string }        // an external credential to revoke first
  | { kind: "delete"; target: string }        // a user_id-scoped table to hard-delete
  | { kind: "anonymize"; target: string }     // a retained table whose user link is nulled
  | { kind: "auth-delete"; target: "auth.users" }; // the final auth-user delete (cascades SET A)

// Order matters: revoke externals BEFORE deleting local rows (we need the token) and BEFORE the auth-user
// delete (which cascades the oauth_tokens away); the auth delete is always LAST.
export function buildPurgePlan(): PurgeStep[] {
  return [
    ...EXTERNAL_REVOCATIONS.map((r) => ({ kind: "revoke" as const, target: r.provider })),
    ...EXPLICIT_DELETE_BY_USER.map((t) => ({ kind: "delete" as const, target: t })),
    ...RETAIN_OR_ANONYMIZE.map((r) => ({ kind: "anonymize" as const, target: r.table })),
    { kind: "auth-delete", target: "auth.users" },
  ];
}
