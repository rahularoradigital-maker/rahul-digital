// Proof for the Source Registry health logic + the static registry shape.
// Run: node --experimental-strip-types scripts/check-growth-sources.ts

import { healthFor, SOURCE_DEFS } from "../lib/growth/source-defs.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

ok(healthFor(true, 12) === "healthy", "ok + items -> healthy");
ok(healthFor(true, 0) === "degraded", "ok but empty -> degraded (reachable, nothing returned)");
ok(healthFor(false, 5) === "down", "not ok -> down");
ok(healthFor(false, 0) === "down", "not ok + empty -> down");

ok(SOURCE_DEFS.length >= 4, "registry lists at least the 4 sources");
ok(new Set(SOURCE_DEFS.map((s) => s.source_id)).size === SOURCE_DEFS.length, "source ids are unique");
ok(SOURCE_DEFS.some((s) => s.source_id === "reddit" && s.status === "needs_setup"), "reddit is flagged needs_setup");
ok(SOURCE_DEFS.every((s) => ["api", "rss", "public-json", "connector"].includes(s.method)), "every source has a known acquisition method");

console.log(`check-growth-sources: ${pass} assertions passed.`);
