// Anti-orphan guardrail for account deletion: every user_id-scoped table in the migrations MUST be classified
// in lib/account/deletion-manifest.ts (cascade / explicit-delete / retain), or a user's data would be left
// behind when they delete their account. This check FAILS the moment a new user-scoped table is added without
// a deletion decision - which is exactly the bug the data-map audit found (many user tables lack an
// auth.users FK cascade). Run: node --experimental-strip-types scripts/check-account-deletion.ts
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CLASSIFIED_TABLES,
  CASCADE_FROM_AUTH_USER,
  EXPLICIT_DELETE_BY_USER,
  RETAIN_OR_ANONYMIZE,
} from "../lib/account/deletion-manifest.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migDir = join(root, "supabase", "migrations");

// Line-scan the migrations: track the current create-table, and mark it user-scoped when a `user_id uuid`
// column is declared inside its body. Robust to multiple columns per line (the influencer tables) and to
// user_id appearing only in later index/policy lines (those are reset out). Reset on the table close or any
// new statement so a column declaration can only attribute to the table it is actually inside.
function userScopedTables(): Set<string> {
  const found = new Set<string>();
  for (const file of readdirSync(migDir).filter((f) => f.endsWith(".sql"))) {
    let current: string | null = null;
    for (const line of readFileSync(join(migDir, file), "utf8").split("\n")) {
      const ct = line.match(/create table (?:if not exists )?(?:public\.)?([a-z_][a-z0-9_]*)/i);
      if (ct) { current = ct[1]; continue; }
      // `user_id uuid` can sit mid-line (multiple columns per line, e.g. the influencer tables). The `uuid`
      // type keyword means it is a COLUMN declaration, not an index/PK reference (those are just `user_id`).
      if (current && /\buser_id\s+uuid\b/i.test(line)) found.add(current);
      if (/^\s*\)\s*;/.test(line) || /^\s*(create|alter|drop|comment|insert|grant)\b/i.test(line)) current = null;
    }
  }
  return found;
}

const scoped = userScopedTables();
assert.ok(scoped.size >= 20, `expected to find the user-scoped tables (found ${scoped.size}) - parser may be broken`);

// 1. THE GUARDRAIL: every user-scoped table is classified. An unclassified table would be orphaned on delete.
const unclassified = [...scoped].filter((t) => !CLASSIFIED_TABLES.has(t)).sort();
assert.deepEqual(
  unclassified, [],
  `Unclassified user-scoped table(s): ${unclassified.join(", ")}. Add each to lib/account/deletion-manifest.ts (cascade / explicit-delete / retain) or a user's data will be orphaned on account deletion.`,
);

// 2. No stale manifest entries (an explicit-delete table that no longer exists as a user table).
for (const t of EXPLICIT_DELETE_BY_USER) {
  if (t === "cockpit_cache") continue; // composite/dynamic DDL, not a plain user_id-uuid column - known exception
  assert.ok(scoped.has(t), `manifest lists '${t}' for explicit delete but no such user-scoped table found in migrations`);
}

// 3. No table double-classified.
const retainSet = new Set(RETAIN_OR_ANONYMIZE.map((r) => r.table));
const buckets: Record<string, number> = {};
for (const t of [...CASCADE_FROM_AUTH_USER, ...EXPLICIT_DELETE_BY_USER, ...retainSet]) buckets[t] = (buckets[t] ?? 0) + 1;
const dupes = Object.entries(buckets).filter(([, n]) => n > 1).map(([t]) => t);
assert.deepEqual(dupes, [], `table(s) classified in more than one deletion bucket: ${dupes.join(", ")}`);

console.log(`PASS: account-deletion coverage (${scoped.size} user-scoped tables, all classified; no orphans, no dupes)`);
