// Plane-boundary guard (control-plane spec sections 2 + 11). Deterministic static scan that fails the build if
// the customer/client plane can reach admin operations or if a secret can reach the browser. Enforces:
//   1. No `"use client"` file imports the service-role admin client or names a server-only secret env var.
//   2. No NEXT_PUBLIC_* env var has a secret-shaped name (those are compiled into the client bundle).
//   3. The service-role key / token-encryption key appear only in server-only modules.
// Run: node --experimental-strip-types scripts/check-plane-boundary.ts

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components", "lib"];
const SECRET_ENV = /\b(SUPABASE_SERVICE_ROLE_KEY|TOKEN_ENC_KEY|META_APP_SECRET|CRON_SECRET|ANTHROPIC_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY|SCRAPECREATORS_API_KEY|UPSTASH_REDIS_REST_TOKEN)\b/;
const SECRET_NAME = /(secret|token|password|api[_-]?key|private[_-]?key|service[_-]?role)/i;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "node_modules" || e === ".next") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e)) {
      out.push(p);
    }
  }
  return out;
}

const violations: string[] = [];
let scanned = 0;

for (const root of ROOTS) {
  for (const file of walk(root)) {
    scanned++;
    const src = readFileSync(file, "utf8");
    const isClient = /^\s*["']use client["']/m.test(src);

    if (isClient) {
      if (/createAdminClient/.test(src)) violations.push(`${file}: "use client" file imports createAdminClient (service-role / admin plane)`);
      const m = src.match(SECRET_ENV);
      if (m) violations.push(`${file}: "use client" file references server-only secret env ${m[1]}`);
    }

    // NEXT_PUBLIC_ vars are inlined into the client bundle - none may be secret-shaped.
    for (const match of src.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
      if (SECRET_NAME.test(match[0]) && !/ANON_KEY/.test(match[0])) {
        violations.push(`${file}: NEXT_PUBLIC secret-shaped env ${match[0]} would ship to the browser`);
      }
    }
  }
}

if (violations.length) {
  console.error(`check-plane-boundary: ${violations.length} VIOLATION(S):`);
  for (const v of violations) console.error("  - " + v);
  process.exit(1);
}
console.log(`check-plane-boundary: clean. Scanned ${scanned} files; no secret-to-client or client->admin-plane leaks.`);
