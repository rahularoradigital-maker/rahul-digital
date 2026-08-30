// Proof for the audit spine's two invariants (buildAuditRow is pure, so no DB needed):
//   1. secrets never survive into an audit row, at any nesting depth
//   2. the row shape is complete and correctly defaulted
// Run: node --experimental-strip-types scripts/check-audit-log.ts

import { buildAuditRow } from "../lib/security/audit-row.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// 1) secret-shaped fields are redacted, including nested + inside arrays
const row = buildAuditRow({
  action: "credential.rotate",
  actorId: "u1",
  actorRole: "admin",
  targetType: "ad_account",
  targetId: "act_123",
  before: { status: "connected", access_token: "SECRET-abc", nested: { refresh: "r-xyz", note: "keep" } },
  after: { status: "connected", api_key: "k-999", list: [{ password: "p1", ok: "yes" }] },
  reason: "scheduled rotation",
});
const b = JSON.stringify(row.before_state);
const a = JSON.stringify(row.after_state);
ok(!b.includes("SECRET-abc"), "access_token value redacted");
ok(!b.includes("r-xyz"), "nested refresh value redacted");
ok(b.includes("keep") && b.includes("connected"), "non-secret fields preserved");
ok(!a.includes("k-999"), "api_key value redacted");
ok(!a.includes("p1"), "password inside array redacted");
ok(a.includes("yes"), "non-secret field inside array preserved");

// 2) row shape complete + correctly defaulted
ok(row.action === "credential.rotate", "action carried through");
ok(row.result === "ok", "result defaults to ok");
ok(row.actor_id === "u1" && row.actor_role === "admin", "actor fields mapped to snake_case");
ok(row.target_type === "ad_account" && row.target_id === "act_123", "target mapped");
ok("before_state" in row && "after_state" in row && "request_id" in row && "approval" in row, "all columns present");

// 3) a denied action records result=denied and needs no state
const denied = buildAuditRow({ action: "killswitch.execute", result: "denied", reason: "insufficient permission" });
ok(denied.result === "denied", "denied result carried");
ok(denied.before_state === null && denied.after_state === null, "absent state -> null, not undefined");

console.log(`check-audit-log: ${pass} assertions passed.`);
