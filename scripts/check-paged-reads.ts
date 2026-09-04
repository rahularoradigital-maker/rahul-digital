// S0 (scale plan) guard: PostgREST silently caps a bare .select() at 1,000 rows. On tables that grow past
// 1,000 rows PER TENANT, an un-paged, un-bounded read returns wrong data with NO error. This lint fails such
// a read on the large tables, forcing .range() paging (readAllPages), an explicit .limit()/.single(), or an
// .in()/count/head bound. Statement-aware (scans each `.from(...)...;` chain, not lines) so it does not
// false-flag .insert().select(), multi-line chains, or .limit()-bounded reads. Run: npm run check:paged-reads
import { strict as assert } from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;

// Tables that can exceed 1,000 rows for a single tenant/account (so a bare per-tenant select truncates).
const LARGE = ["ad_metrics", "ad_meta", "ad_changes", "ad_accounts", "creative_semantics", "influencer_search_result"];
// Tokens that make a read bounded/safe, or mark it a write (not a read).
const BOUNDED = [".range(", ".limit(", ".maybeSingle(", ".single(", "head: true", "count:", ".in(", ".insert(", ".update(", ".upsert(", ".delete("];
// Explicit, reviewed exceptions (file -> why). Empty today.
const ALLOW = new Set<string>([]);

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === ".next" || n === ".git") continue;
    const p = `${dir}/${n}`;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const files = [`${ROOT}app`, `${ROOT}lib`].flatMap((d) => walk(d));
const offenders: string[] = [];

for (const abs of files) {
  const rel = abs.slice(ROOT.length);
  if (ALLOW.has(rel)) continue;
  // Strip comments first: a ";" inside a comment (e.g. "active account; connected_at") would otherwise
  // truncate the statement capture early and false-flag a bounded query.
  const src = readFileSync(abs, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  for (const table of LARGE) {
    const needle = `.from("${table}")`;
    let i = src.indexOf(needle);
    while (i !== -1) {
      // Capture the query chain: from `.from(...)` to the statement terminator (`;`), capped so we never run away.
      const end = src.indexOf(";", i);
      const stmt = src.slice(i, end === -1 ? Math.min(i + 800, src.length) : end);
      if (stmt.includes(".select(") && !BOUNDED.some((b) => stmt.includes(b))) {
        const line = src.slice(0, i).split("\n").length;
        offenders.push(`${rel}:${line}  .from("${table}") unbounded select (page it, or bound with .limit/.in/.maybeSingle)`);
      }
      i = src.indexOf(needle, i + needle.length);
    }
  }
}

assert.deepEqual(offenders, [], `unbounded reads on large-per-tenant tables (PostgREST caps at 1,000 rows):\n  ${offenders.join("\n  ")}`);
console.log(`PASS: paged-reads (no unbounded selects on ${LARGE.length} large-per-tenant tables)`);
