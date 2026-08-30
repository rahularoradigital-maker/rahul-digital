// Proof for data classification: the tiers imply the right protections, and the most dangerous tables sit at
// the top tier. Run: node --experimental-strip-types scripts/check-classification.ts

import { classify, policyFor, isLoggable } from "../lib/security/classification.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// credentials are the highest tier: app-encrypted, never logged, service-role only, no auto-expiry
ok(classify("oauth_tokens") === "HIGHLY_SENSITIVE", "oauth_tokens is HIGHLY_SENSITIVE");
ok(classify("shopify_connections") === "HIGHLY_SENSITIVE", "shopify_connections is HIGHLY_SENSITIVE");
ok(policyFor("oauth_tokens").encryptAtRest === true, "credentials require app-level encryption");
ok(!isLoggable("oauth_tokens"), "credentials are never loggable");

// customer performance data is confidential + not loggable
ok(classify("ad_metrics") === "CONFIDENTIAL", "ad_metrics is CONFIDENTIAL");
ok(!isLoggable("ad_metrics"), "customer performance is not loggable");
ok(policyFor("ad_metrics").access === "tenant", "customer data is tenant-scoped");

// control-plane records are internal + loggable (no customer PII in them by design)
ok(classify("audit_log") === "INTERNAL", "audit_log is INTERNAL");
ok(classify("system_flags") === "INTERNAL", "system_flags is INTERNAL");

// membership/identity is sensitive
ok(classify("org_members") === "SENSITIVE", "org_members is SENSITIVE");

// unknown table -> safe default (CONFIDENTIAL, not loggable)
ok(classify("some_new_table_xyz") === "CONFIDENTIAL", "unknown table defaults to CONFIDENTIAL");
ok(!isLoggable("some_new_table_xyz"), "unknown table is not loggable by default");

// invariant: nothing sensitive-or-higher is loggable
for (const t of ["oauth_tokens", "shopify_connections", "ad_metrics", "org_members", "decision_triples"]) {
  ok(!isLoggable(t), `${t} must not be loggable`);
}

console.log(`check-classification: ${pass} assertions passed.`);
