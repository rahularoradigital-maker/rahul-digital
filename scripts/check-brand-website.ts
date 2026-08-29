// One runnable check for brand-website host discovery. No frameworks.
// Run: node --experimental-strip-types scripts/check-brand-website.ts
import assert from "node:assert/strict";
import { pickBrandWebsiteHost } from "../lib/meta-source.ts";

// The most common real brand domain wins, and www. is stripped.
assert.equal(
  pickBrandWebsiteHost([
    "https://www.soch.com/in/kurtas",
    "https://soch.com/in/sarees",
    "https://www.soch.com/in/new",
  ]),
  "soch.com",
  "dominant brand host, www stripped",
);

// Social / messaging / marketplace hosts are NOT the website - a real brand domain always beats them.
assert.equal(
  pickBrandWebsiteHost([
    "https://www.facebook.com/soch",
    "https://api.whatsapp.com/send?phone=91",
    "https://www.amazon.in/soch",
    "https://soch.com/in/",
  ]),
  "soch.com",
  "real domain beats marketplace/social even if they are frequent",
);

// If ONLY non-brand hosts exist, fall back to the most common one rather than null (better than nothing).
assert.equal(
  pickBrandWebsiteHost(["https://www.amazon.in/x", "https://www.amazon.in/y", "https://myntra.com/z"]),
  "amazon.in",
  "fallback to most-common marketplace when no own domain is present",
);

// No usable links -> null (never a fabricated domain).
assert.equal(pickBrandWebsiteHost([null, undefined, "not a url", ""]), null, "no links -> null, never guessed");

// Query strings / paths never leak into the host.
assert.equal(pickBrandWebsiteHost(["https://shop.brand.co/collections/all?utm=fb"]), "shop.brand.co", "subdomain kept, path/query dropped");

console.log("PASS: brand-website host discovery (dominant real domain, non-brand fallback, null-safe)");
