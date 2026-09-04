// PURE (no server-only, no I/O) so the gate exercises the safety rules. Defines WHAT a user's data export
// contains and, critically, what it must NEVER contain. GDPR data-portability's safety property is: export the
// user's own data, never a credential. Two independent guards enforce that:
//   1. A curated ALLOWLIST of tables (below) - secrets live in their own tables, which are simply not listed.
//   2. A per-row scrub that strips any secret-looking column - defense-in-depth, so even a mis-listed column
//      or a future schema change can't leak a token.

// The user-owned tables that go into an export, each with the column its rows are keyed on. Deliberately a
// small, meaningful, portable set (account config + analysis outputs + usage), NOT every raw table - raw
// day-wise metrics can be hundreds of thousands of rows and are re-derivable from Meta.
export const EXPORT_TABLES: { table: string; key: "id" | "user_id" }[] = [
  { table: "profiles", key: "id" },              // account: email, plan, access state
  { table: "ad_accounts", key: "user_id" },      // connected accounts (identifiers only; tokens live elsewhere)
  { table: "account_rollups", key: "user_id" },  // instant-app account rollups (their analysis)
  { table: "creative_rollups", key: "user_id" }, // per-creative rollups
  { table: "account_verifications", key: "user_id" }, // self-proving accuracy trend
  { table: "token_usage", key: "user_id" },      // their metered usage
  { table: "notifications", key: "user_id" },    // their notifications
];

// Tables that hold SECRETS and must never be exported (asserted by the check against EXPORT_TABLES).
export const SECRET_TABLES = ["oauth_tokens", "provider_keys"] as const;

// A column whose NAME implies a credential - stripped from every exported row regardless of table.
export function isSecretKey(key: string): boolean {
  return /token|secret|password|access[_-]?key|refresh|credential|api[_-]?key|encrypted/i.test(key);
}

// Defense-in-depth: drop any secret-looking field from a row before it leaves the server.
export function scrubRow<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!isSecretKey(k)) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}
