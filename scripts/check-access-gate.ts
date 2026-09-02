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

// 3) EVERY exported HTTP method of EVERY product route is gated - asserted PER METHOD, not per file.
//    Phase-0 audit: the old file-granular check (`src.includes("guardProductApi")`) passed a file whose GET was
//    gated while its POST was wide open - that is exactly how 5 mutating handlers (2 of them billing LLM calls)
//    shipped without the entitlement gate. A method counts as gated when it is wrapped in withProductApi /
//    withAdminApi, or its OWN body calls guardProductApi(). Routes that are intentionally NOT product-gated
//    (public funnel, cron/bearer, admin-allowlist, own-user reads) are named explicitly below - anything new
//    under app/api is gated by default, so a forgotten guard turns this red instead of shipping.
import { readdirSync } from "node:fs";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const NOT_PRODUCT_GATED = new Set([
  "app/api/leads/route.ts", // public lead form (rate-limited + honeypot)
  "app/api/health/route.ts", // public liveness; detail is admin-gated inside
  "app/api/influencer/avatar/route.ts", // session + rate-limit + byte cap (image proxy)
  "app/api/usage/route.ts", // own-user token meter (read-only)
  "app/api/jobs/[id]/route.ts", // own-user job status (user_id-scoped)
  "app/api/jobs/drain/route.ts", // CRON_SECRET bearer
  "app/api/cron/sync/route.ts", // CRON_SECRET bearer
  "app/api/cron/growth/route.ts", // CRON_SECRET bearer
  "app/api/cron/rollups/route.ts", // CRON_SECRET bearer (10x #5 instant-app rollup refresher)
  "app/api/admin/access/route.ts", // isAdminEmail
  "app/api/admin/invite/route.ts", // isAdminEmail
  "app/api/admin/keys/route.ts", // isAdminEmail
  "app/api/growth/article/route.ts", // isAdminEmail
  "app/api/growth/review/route.ts", // isAdminEmail
]);
const routeFiles = readdirSync(ROOT + "app/api", { recursive: true, encoding: "utf8" })
  .filter((p) => p.endsWith("route.ts"))
  .map((p) => "app/api/" + p.replace(/\\/g, "/"));
assert.ok(routeFiles.length >= 40, `route discovery found ${routeFiles.length} files (expected 40+)`);

let gatedMethods = 0;
for (const r of routeFiles) {
  if (NOT_PRODUCT_GATED.has(r)) continue;
  const src = read(r);
  for (const m of METHODS) {
    // Wrapped form: `export const POST = withProductApi(` / `withAdminApi(`.
    if (new RegExp(`export\\s+const\\s+${m}\\s*=\\s*with(Product|Admin)Api\\(`).test(src)) { gatedMethods++; continue; }
    // Function form: capture THIS handler's body (up to the next top-level export or EOF) and require the guard inside it.
    const fn = src.match(new RegExp(`export\\s+async\\s+function\\s+${m}\\s*\\(([\\s\\S]*?)(?=\\n\\s*export\\s|$)`));
    if (!fn) continue; // method not exported by this route
    assert.ok(/guardProductApi\s*\(/.test(fn[1]), `${r} ${m}: handler body must call guardProductApi() or be wrapped in withProductApi (spend/authz bypass otherwise)`);
    gatedMethods++;
  }
}

// 4) The public / admin / cron routes must NOT be product-gated (would break the funnel or their own auth).
for (const r of ["app/api/leads/route.ts", "app/api/admin/invite/route.ts", "app/api/cron/sync/route.ts"]) {
  assert.ok(!read(r).includes("guardProductApi"), `${r} must NOT be product-gated`);
}

console.log(`OK check-access-gate: fail-closed gate, layout enforced, ${gatedMethods} exported product-API methods gated across ${routeFiles.length - NOT_PRODUCT_GATED.size} routes, ${NOT_PRODUCT_GATED.size} public/admin/cron routes explicitly exempt.`);
