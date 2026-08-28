// Runnable check for the security headers in next.config.ts (ISSUE 16 regression guard). No env.
//   node --experimental-strip-types scripts/check-csp.ts
// Asserts the CSP is ENFORCED (not report-only) and still carries the load-bearing directives, so a
// future edit can't silently weaken it back to report-only or drop object-src/frame-ancestors.
import { strict as assert } from "node:assert";
import nextConfig, { csp } from "../next.config.ts";

const groups = await nextConfig.headers!();
const headers = groups.flatMap((g) => g.headers);
const keys = headers.map((h) => h.key);

// Enforced, not report-only.
assert.ok(keys.includes("Content-Security-Policy"), "CSP must be enforced (Content-Security-Policy)");
assert.ok(!keys.includes("Content-Security-Policy-Report-Only"), "must not ship report-only CSP");

// The enforced header value is the shared csp string.
const cspHeader = headers.find((h) => h.key === "Content-Security-Policy");
assert.equal(cspHeader?.value, csp, "enforced CSP header uses the canonical csp");

// Load-bearing directives are present.
for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "connect-src 'self' https://*.supabase.co"]) {
  assert.ok(csp.includes(directive), `CSP must keep: ${directive}`);
}

// Other baseline security headers stay present.
for (const key of ["X-Content-Type-Options", "Strict-Transport-Security", "Referrer-Policy"]) {
  assert.ok(keys.includes(key), `missing security header: ${key}`);
}

console.log("PASS: CSP enforced + load-bearing directives + baseline security headers present");
