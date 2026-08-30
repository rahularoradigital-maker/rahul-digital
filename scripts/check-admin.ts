// Runnable check for the admin allowlist (lib/admin.ts). No I/O.
// node --experimental-strip-types scripts/check-admin.ts
import assert from "node:assert/strict";
import { isAdminEmail } from "../lib/admin.ts";

// Default (ADMIN_EMAILS unset) -> the founder account only.
delete process.env.ADMIN_EMAILS;
assert.equal(isAdminEmail("digitalwave27@gmail.com"), true, "default admin");
assert.equal(isAdminEmail("DigitalWave27@Gmail.com"), true, "case-insensitive");
assert.equal(isAdminEmail("someone@else.com"), false, "non-admin rejected");
assert.equal(isAdminEmail(null), false);
assert.equal(isAdminEmail(""), false);
assert.equal(isAdminEmail(undefined), false);

// Explicit allowlist replaces the default and supports a comma list + spacing.
process.env.ADMIN_EMAILS = "a@x.com, B@Y.com";
assert.equal(isAdminEmail("a@x.com"), true);
assert.equal(isAdminEmail("b@y.com"), true, "case-insensitive list");
assert.equal(isAdminEmail("digitalwave27@gmail.com"), false, "default no longer applies once set");

console.log("PASS: admin allowlist (default founder, comma list, case-insensitive, reject others)");
