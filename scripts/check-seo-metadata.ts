// SEO regression gate: the technical-SEO invariants that must not silently break. The route handlers
// (robots.ts / sitemap.ts / layout.tsx) are Next server files that can't be node-imported (server-only +
// @/ aliases), so this asserts on their SOURCE - catching the real regressions: blog dropped from the
// sitemap, the app un-disallowed in robots, canonical/metadataBase/JSON-LD removed. No frameworks.
// Run: node --experimental-strip-types scripts/check-seo-metadata.ts
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p: string) => readFileSync(ROOT + p, "utf8");

// --- robots.ts: private app areas disallowed, public allowed, sitemap referenced ---
const robots = read("app/robots.ts");
for (const d of ["/app", "/api", "/auth"]) assert.ok(robots.includes(`"${d}"`), `robots must disallow ${d}`);
assert.ok(/allow:\s*"\/"/.test(robots), "robots must allow the public root");
assert.ok(robots.includes("sitemap.xml"), "robots must reference the sitemap");

// --- sitemap.ts: home + product + blog included; private areas never listed ---
const sitemap = read("app/sitemap.ts");
for (const p of ['"/product"', '"/blog"', '"/book-demo"']) assert.ok(sitemap.includes(p), `sitemap must include ${p}`);
assert.ok(sitemap.includes("/blog/${a.slug}") || sitemap.includes("/blog/"), "sitemap must add published blog posts");
for (const bad of ["/app", "/login", "/signup"]) assert.ok(!sitemap.includes(`"${bad}"`), `sitemap must NOT list ${bad}`);

// --- layout.tsx: metadataBase, canonical, robots index, and JSON-LD entity signals ---
const layout = read("app/layout.tsx");
assert.ok(layout.includes("metadataBase"), "root metadata needs metadataBase");
assert.ok(layout.includes("canonical"), "root metadata needs a canonical");
assert.ok(/index:\s*true/.test(layout), "root must be indexable");
assert.ok(layout.includes("application/ld+json"), "root must emit JSON-LD");
for (const t of ["Organization", "WebSite", "SoftwareApplication"]) assert.ok(layout.includes(`"${t}"`), `JSON-LD must include ${t}`);

// --- blog post: canonical + BlogPosting/Breadcrumb schema (per-article entity signals) ---
const post = read("app/blog/[slug]/page.tsx");
assert.ok(post.includes("canonical"), "blog post needs a canonical");
assert.ok(post.includes("BlogPosting") && post.includes("BreadcrumbList"), "blog post needs BlogPosting + BreadcrumbList schema");

console.log("OK check-seo-metadata: robots disallows app/api/auth, sitemap includes blog, layout has canonical + Org/WebSite/SoftwareApplication JSON-LD, blog posts carry canonical + schema.");
