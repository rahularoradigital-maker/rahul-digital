// S5 (deletion): prove the purge EXECUTOR's plan covers the deletion MANIFEST, correct-by-construction, with
// no DB. check-account-deletion.ts proves every user-scoped table is CLASSIFIED; this proves the executor
// actually ACTS on each explicit-delete table + external revocation, in a safe order (revokes and local
// deletes before the irreversible auth-user delete, which is strictly last).
// Run: node --experimental-strip-types scripts/check-account-purge.ts
import assert from "node:assert/strict";
import { buildPurgePlan } from "../lib/account/purge-plan.ts";
import { EXPLICIT_DELETE_BY_USER, EXTERNAL_REVOCATIONS, RETAIN_OR_ANONYMIZE } from "../lib/account/deletion-manifest.ts";

const plan = buildPurgePlan();
const deletes = new Set(plan.filter((s) => s.kind === "delete").map((s) => s.target));
const revokes = new Set(plan.filter((s) => s.kind === "revoke").map((s) => s.target));
const anonymizes = new Set(plan.filter((s) => s.kind === "anonymize").map((s) => s.target));

// 1. Every explicit-delete table in the manifest has a delete step (no user data orphaned).
for (const t of EXPLICIT_DELETE_BY_USER) {
  assert.ok(deletes.has(t), `purge plan is missing a delete step for '${t}' - that user data would be orphaned`);
}
assert.equal(deletes.size, EXPLICIT_DELETE_BY_USER.length, "no extra/duplicate delete steps beyond the manifest");

// 2. Every external revocation is planned (a credential must be revoked, never silently left live).
for (const r of EXTERNAL_REVOCATIONS) {
  assert.ok(revokes.has(r.provider), `purge plan is missing a revoke step for '${r.provider}'`);
}

// 3. Every retained/anonymized table is represented (so nothing in that bucket is forgotten).
for (const r of RETAIN_OR_ANONYMIZE) {
  assert.ok(anonymizes.has(r.table), `purge plan is missing an anonymize step for '${r.table}'`);
}

// 4. SAFETY ORDER: the auth-user delete is the LAST step (it cascades SET A - point of no return), and every
//    revoke happens before it (we need the live token to revoke at the provider).
const authIdx = plan.findIndex((s) => s.kind === "auth-delete");
assert.ok(authIdx !== -1, "plan must end by deleting the auth user");
assert.equal(authIdx, plan.length - 1, "auth-user delete must be the LAST step (it cascades everything)");
assert.ok(
  plan.every((s, i) => s.kind !== "revoke" || i < authIdx),
  "every external revoke must come BEFORE the auth-user delete (the token cascades away with it)",
);
assert.equal(plan.filter((s) => s.kind === "auth-delete").length, 1, "exactly one auth-user delete step");

console.log(`PASS: account purge plan (${deletes.size} tables deleted, ${revokes.size} revoked, ${anonymizes.size} anonymized, auth-user delete last)`);
