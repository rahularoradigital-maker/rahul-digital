// S5 (export): prove the GDPR data-export can never leak a credential. No DB - asserts the pure spec:
//   1. No SECRET_TABLES appear in the export allowlist.
//   2. The row scrub strips every secret-looking field (token/secret/password/api-key/etc), keeps normal ones.
//   3. The allowlist is non-trivial and every entry keys on id or user_id (tenancy-scoped, never a global read).
// Run: node --experimental-strip-types scripts/check-account-export.ts
import assert from "node:assert/strict";
import { EXPORT_TABLES, SECRET_TABLES, isSecretKey, scrubRow } from "../lib/account/export-spec.ts";

// 1. Secret tables must NOT be in the export allowlist.
const exported = new Set(EXPORT_TABLES.map((t) => t.table));
for (const s of SECRET_TABLES) {
  assert.ok(!exported.has(s), `export allowlist must never include the secret table '${s}'`);
}
assert.ok(EXPORT_TABLES.length >= 3, "export should cover the user's meaningful data (>=3 tables)");

// 2. Every entry is tenancy-scoped by id or user_id (never an unscoped/global read).
for (const t of EXPORT_TABLES) {
  assert.ok(t.key === "id" || t.key === "user_id", `export table '${t.table}' must be scoped by id or user_id (got '${t.key}')`);
}

// 3. Secret-key detection: catches the common credential field names, ignores normal ones.
for (const k of ["access_token", "refresh_token", "api_key", "apiKey", "secret", "password", "encrypted_value", "meta_token", "credential"]) {
  assert.ok(isSecretKey(k), `isSecretKey must flag '${k}'`);
}
for (const k of ["id", "user_id", "email", "plan", "spend", "revenue", "created_at", "account_name", "status"]) {
  assert.ok(!isSecretKey(k), `isSecretKey must NOT flag the normal field '${k}'`);
}

// 4. scrubRow removes secret fields, keeps the rest (and does not mutate values).
const scrubbed = scrubRow({ id: "u1", email: "a@b.com", access_token: "SECRET", refresh_token: "SECRET2", spend: 1234 });
assert.deepEqual(scrubbed, { id: "u1", email: "a@b.com", spend: 1234 }, "scrubRow keeps normal fields, drops token fields");
assert.ok(!("access_token" in scrubbed) && !("refresh_token" in scrubbed), "no secret field survives the scrub");

console.log(`PASS: account export safety (${EXPORT_TABLES.length} tables, 0 secret tables, all tenancy-scoped, secrets scrubbed)`);
