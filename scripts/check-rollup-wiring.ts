// Guard (10x #5): the rollup population must stay wired into the sync paths. A future refactor that drops the
// refresh calls would silently stop rollups updating - dashboards would quietly serve stale numbers with no
// error. This asserts the wiring by source text. Run: npm run check:rollup-wiring
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p: string) => readFileSync(ROOT + p, "utf8");

// Each sync entry point must refresh BOTH rollups when an account finishes syncing.
for (const route of ["app/api/ingest/run/route.ts", "app/api/cron/sync/route.ts", "app/api/cron/rollups/route.ts"]) {
  const src = read(route);
  assert.ok(/refreshAccountRollup\s*\(/.test(src), `${route} must call refreshAccountRollup (rollup population dropped?)`);
  assert.ok(/refreshCreativeRollup\s*\(/.test(src), `${route} must call refreshCreativeRollup (creative rollup population dropped?)`);
}

// The reconcile read path must keep its self-heal (save what it scanned) so a page works before any sync.
assert.ok(/saveAccountReport\s*\(/.test(read("lib/reconcile/store.ts")), "reconcile store must self-heal the rollup (saveAccountReport)");

console.log("PASS: rollup wiring (sync paths refresh account+creative rollups; reconcile self-heals)");
