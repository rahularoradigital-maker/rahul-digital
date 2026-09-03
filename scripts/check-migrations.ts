// Migration-trust guard (cleanup #1: make migrations trustworthy). The runner applies EVERY .sql in
// supabase/migrations/ in filename order, so this check enforces the invariants that keep that safe:
//  1. No down/rollback/revert file in the applied folder (those live in supabase/rollbacks/, applied by hand).
//  2. Every migration is named NNNN_snake_case.sql.
//  3. No NEW duplicate ordinal. The already-applied collisions (0007/0017/0018/0019/0020) are grandfathered -
//     renaming an applied migration is unsafe - but any NEW collision fails, so the numbering stays trustworthy.
// Run: node --experimental-strip-types scripts/check-migrations.ts
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migDir = join(root, "supabase", "migrations");

// Collisions that already exist in production. Applied migrations must NOT be renamed (the runner tracks them
// by filename), so these are accepted; the check only forbids ADDING a new one.
// 0030: two features landed the same ordinal in parallel (ad_optimization_event + cp_advertised_product_ids);
// both are already APPLIED to prod, so renaming would be riskier than accepting the collision (apply-order is
// moot once both are applied). Grandfathered, consistent with the earlier duplicates.
const GRANDFATHERED_DUPLICATE_ORDINALS = new Set(["0007", "0017", "0018", "0019", "0020", "0030"]);

const files = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
assert.ok(files.length >= 20, `expected the migration set (found ${files.length})`);

// 1. No rollback/down files in the auto-applied folder.
// Match the rollback MARKER only as the trailing suffix (the convention is `<name>_down.sql` /
// `_rollback.sql`), not anywhere in the name - otherwise a legit forward migration like
// `0032_lock_down_...sql` false-trips on the substring "_down" and reds the whole gate.
const downFiles = files.filter((f) => /[._](down|rollback|revert|undo)\.sql$/i.test(f));
assert.deepEqual(downFiles, [], `rollback/down migration(s) in supabase/migrations/: ${downFiles.join(", ")}. Move them to supabase/rollbacks/ - the runner would apply them forward and undo the migration.`);

// 2. Naming convention NNNN_snake_case.sql.
const badNames = files.filter((f) => !/^\d{4}_[a-z0-9_]+\.sql$/.test(f));
assert.deepEqual(badNames, [], `migration(s) not named NNNN_snake_case.sql: ${badNames.join(", ")}`);

// 3. No NEW duplicate ordinal (grandfather the applied ones).
const byOrdinal: Record<string, string[]> = {};
for (const f of files) {
  const ord = f.slice(0, 4);
  (byOrdinal[ord] ??= []).push(f);
}
const newDupes = Object.entries(byOrdinal)
  .filter(([ord, fs]) => fs.length > 1 && !GRANDFATHERED_DUPLICATE_ORDINALS.has(ord))
  .map(([ord, fs]) => `${ord}: ${fs.join(", ")}`);
assert.deepEqual(newDupes, [], `NEW duplicate migration ordinal(s): ${newDupes.join(" | ")}. Use the next free number so apply-order is unambiguous.`);

// 4. Sanity: the grandfathered ordinals still ARE duplicated (else drop them from the allowlist so a genuine
//    future collision on that number is caught).
const staleGrandfather = [...GRANDFATHERED_DUPLICATE_ORDINALS].filter((ord) => (byOrdinal[ord]?.length ?? 0) <= 1);
assert.deepEqual(staleGrandfather, [], `grandfathered ordinal(s) no longer collide - remove from the allowlist: ${staleGrandfather.join(", ")}`);

console.log(`PASS: migrations trustworthy (${files.length} files: named, no rollbacks in the applied folder, no new ordinal collisions)`);
