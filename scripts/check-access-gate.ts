// Security regression gate for the private-beta access control (docs/access-control-plan.md). The gate code
// is server-only (not node-loadable), so this asserts the INVARIANTS on source: the layout enforces product
// access, the gate is fail-CLOSED (never fail-open), and every expensive product API carries guardProductApi
// BEFORE it can burn Meta/Gemini/ScrapeCreators/image spend. A removed guard = a bypass = this gate goes red.
// Run: node --experimental-strip-types scripts/check-access-gate.ts
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p: string) => readFileSync(ROOT + p, "utf8");

// 1) The gate itself is fail-closed.
const gate = read("lib/app/access.ts");
assert.ok(gate.includes('"WAITLIST"') && gate.includes("PRODUCT_OK"), "access gate defines states + PRODUCT_OK");
// Inspect the ACTUAL Set literal contents, not loose text (a comment may mention any state).
const setMatch = gate.match(/PRODUCT_OK[^=]*=\s*new Set<AccessState>\(\[([^\]]*)\]\)/);
assert.ok(setMatch, "PRODUCT_OK is a Set literal of allowed states");
const okStates = setMatch![1];
assert.ok(okStates.includes("APPROVED") && okStates.includes("ADMIN"), "APPROVED + ADMIN grant product access");
for (const denied of ["WAITLIST", "SUSPENDED", "REVOKED", "INVITED"]) {
  assert.ok(!okStates.includes(denied), `${denied} must NOT be in PRODUCT_OK`);
}
// Fail CLOSED: the catch + missing-row branches default to WAITLIST, never to an allowed state.
assert.ok(/\?\?\s*"WAITLIST"/.test(gate), "missing profile row must default to WAITLIST");
assert.ok(/catch[\s\S]*WAITLIST/.test(gate), "a DB error must fail closed to WAITLIST, never fail open");
assert.ok(gate.includes("isAdminEmail"), "admin allowlist short-circuit present (staff never locked out)");

// 2) The /app layout enforces product access on navigation.
const layout = read("app/app/layout.tsx");
assert.ok(layout.includes("requireProductAccess"), "app layout must call requireProductAccess");

// 3) Every expensive product API gates BEFORE the expensive call. A guard that is missing = a spend bypass.
const MUST_GATE = [
  "app/api/ask/route.ts",
  "app/api/creative/analyze/route.ts",
  "app/api/brand/discover/route.ts",
  "app/api/market/positioning/route.ts",
  "app/api/creative-production/generate/route.ts",
  "app/api/creative-production/concepts/route.ts",
  "app/api/competitors/run/route.ts",
  "app/api/competitors/analyze/route.ts",
  "app/api/influencer/run/route.ts",
  "app/api/ingest/run/route.ts",
  "app/api/meta/accounts/route.ts",
  "app/api/meta/campaigns/route.ts",
  "app/api/funnel/route.ts",
  "app/api/reconcile/route.ts",
  "app/api/connect/meta/authorize/route.ts",
  "app/api/connect/meta/callback/route.ts",
  "app/api/connect/meta/select-account/route.ts",
];
for (const r of MUST_GATE) {
  const src = read(r);
  assert.ok(src.includes("guardProductApi"), `${r} must call guardProductApi (spend bypass otherwise)`);
}

// 4) The public / admin / cron routes must NOT be product-gated (would break the funnel or their own auth).
for (const r of ["app/api/leads/route.ts", "app/api/admin/invite/route.ts", "app/api/cron/sync/route.ts"]) {
  assert.ok(!read(r).includes("guardProductApi"), `${r} must NOT be product-gated`);
}

console.log(`OK check-access-gate: fail-closed gate, layout enforced, ${MUST_GATE.length} expensive APIs guarded, public/admin/cron ungated.`);
