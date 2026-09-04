// First-party analytics classifier rules (lib/analytics/classify.ts). No I/O. Guards that the beacon counts
// the right traffic (never the signed-in product or files) and normalizes paths/referrers safely.
// Run: node --experimental-strip-types scripts/check-analytics.ts
import assert from "node:assert/strict";
import { isTrackablePath, isBlogPost, blogSlug, refHost, normalizePath } from "../lib/analytics/classify.ts";

// isTrackablePath: website + blog yes; product/api/next/files no.
for (const p of ["/", "/product", "/pricing", "/blog", "/blog/scaling-meta-ads"]) assert.ok(isTrackablePath(p), `should track ${p}`);
for (const p of ["/app", "/app/settings", "/api/analytics", "/_next/static/x.js", "/sitemap.xml", "/icon.svg", ""]) assert.ok(!isTrackablePath(p), `should NOT track ${p}`);

// blog post detection + slug (index is not a post).
assert.ok(isBlogPost("/blog/scaling-meta-ads") && isBlogPost("/blog/scaling-meta-ads/"), "blog post detected");
assert.ok(!isBlogPost("/blog") && !isBlogPost("/blog/a/b"), "index / nested is not a single post");
assert.equal(blogSlug("/blog/scaling-meta-ads"), "scaling-meta-ads", "slug extracted");
assert.equal(blogSlug("/blog"), null, "no slug for the index");

// refHost: host only, own-site + junk -> direct.
assert.equal(refHost("https://www.google.com/search?q=x"), "google.com", "host only, www stripped");
assert.equal(refHost("https://t.co/abc"), "t.co");
assert.equal(refHost(null), "direct", "no referrer -> direct");
assert.equal(refHost("not a url"), "direct", "junk -> direct");
assert.equal(refHost("https://adscaledigital.co/pricing", "adscaledigital.co"), "direct", "own host -> direct (internal nav)");

// normalizePath: strips query/hash, bounds length, rejects non-paths.
assert.equal(normalizePath("/blog/x?utm=1#top"), "/blog/x", "query + hash stripped");
assert.equal(normalizePath("blog/x"), null, "must be absolute");
assert.equal(normalizePath(123), null, "non-string rejected");
assert.equal(normalizePath("/" + "a".repeat(500))!.length, 256, "length bounded to 256");

console.log("PASS: analytics classifiers (trackable paths, blog detection, referrer host, path normalization)");
