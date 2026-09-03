// Phase 5 (audit) store-boundary guard for the instant-app rollup + self-proving subsystem. The tables
// account_rollups / creative_rollups / account_verifications are OWNED by lib/rollups/* (the store modules);
// every read/write must go through those modules, so tenancy scoping + freshness logic live in ONE place and
// can't drift. The health probe is the single allowed exception (admin observability read). This prevents the
// entropy where a new session queries these tables ad-hoc and forgets the user-scoping.
// Run: npm run check:rollup-boundary
import { strict as assert } from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const OWNED = /\.from\(\s*["'](account_rollups|creative_rollups|account_verifications)["']/;
const ALLOWED_PREFIXES = ["lib/rollups/"]; // the store modules
const ALLOWED_FILES = new Set(["app/api/health/route.ts"]); // admin observability read only

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === ".next" || n === ".git") continue;
    const p = `${dir}/${n}`;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const files = [`${ROOT}app`, `${ROOT}components`, `${ROOT}lib`].flatMap((d) => walk(d));
const offenders: string[] = [];
for (const abs of files) {
  const rel = abs.slice(ROOT.length);
  if (ALLOWED_PREFIXES.some((p) => rel.startsWith(p)) || ALLOWED_FILES.has(rel)) continue;
  if (OWNED.test(readFileSync(abs, "utf8"))) offenders.push(rel);
}

assert.deepEqual(
  offenders,
  [],
  `rollup/verification tables accessed outside lib/rollups/ (and the health probe): ${offenders.join(", ")}. ` +
    `Read/write them through lib/rollups/* so user-scoping + freshness stay in one place.`,
);

// Sanity: the store modules actually exist and own the tables (else the guard is vacuously green).
for (const f of ["lib/rollups/account.ts", "lib/rollups/creative.ts", "lib/rollups/verification.ts"]) {
  assert.ok(OWNED.test(readFileSync(ROOT + f, "utf8")), `${f} should own one of the rollup tables (guard sanity)`);
}

console.log("PASS: rollup store-boundary (rollup/verification tables accessed only via lib/rollups/* + health probe)");
