// Runnable check for lib/brand/parse.ts (pure brand-profile parsing).
// Run: node --experimental-strip-types scripts/check-brand.ts
import assert from "node:assert/strict";
import { parseDerived } from "../lib/brand/parse.ts";
import { buildSearchQueries, shortlistCandidates, ownBrandToken } from "../lib/brand/discover.ts";

// Normal case: strings pass through; list fields split on comma/semicolon; "unknown" -> null.
const d = parseDerived({
  category: "Bath & Body / Personal Care",
  subcategories: "perfume, bath, gifting",
  key_products: "Rakhi gift set; body mist; room spray",
  price_positioning: "mass premium",
  target_market: "India",
  brand_voice: "warm, gifting-led",
  summary: "A personal-care and gifting brand.",
  website: "unknown",
});
assert.equal(d.category, "Bath & Body / Personal Care");
assert.deepEqual(d.subcategories, ["perfume", "bath", "gifting"]);
assert.deepEqual(d.keyProducts, ["Rakhi gift set", "body mist", "room spray"], "splits on comma AND semicolon");
assert.equal(d.pricePositioning, "mass premium");
assert.equal(d.targetMarket, "India");
assert.equal(d.website, null, "'unknown' -> null");

// "n/a", blanks, and missing keys -> null / empty list (never a fabricated value).
const empty = parseDerived({ category: "n/a", subcategories: "", brand_voice: "  " });
assert.equal(empty.category, null);
assert.deepEqual(empty.subcategories, []);
assert.equal(empty.brandVoice, null);
assert.equal(empty.summary, null, "missing key -> null");
assert.deepEqual(empty.keyProducts, []);

// Non-string values are ignored (never coerced into a fake string).
const weird = parseDerived({ category: 42, subcategories: null });
assert.equal(weird.category, null);
assert.deepEqual(weird.subcategories, []);

// Lists are capped at 12.
const many = parseDerived({ subcategories: Array.from({ length: 20 }, (_, i) => `s${i}`).join(",") });
assert.equal(many.subcategories.length, 12, "list capped at 12");

// --- Stage 2 discovery (pure) ---
// Queries: sub-categories first, then products, then category; deduped; capped.
assert.deepEqual(
  buildSearchQueries("apparel", ["kurta sets", "suit sets"], ["kurta sets", "dresses"]),
  ["kurta sets", "suit sets", "dresses", "apparel"],
  "queries dedupe and order sub-cats > products > category",
);
assert.equal(buildSearchQueries(null, [], []).length, 0, "no signal -> no queries");
assert.equal(buildSearchQueries("cat", ["aaa", "bbb", "ccc", "ddd", "eee", "fff"], []).length, 5, "queries capped at 5");
assert.deepEqual(buildSearchQueries("cat", ["ab", "xyz"], []), ["xyz", "cat"], "queries shorter than 3 chars are dropped");

// ownBrandToken: distinctive first token before a separator.
assert.equal(ownBrandToken("Soch Apparels - 2022"), "soch");
assert.equal(ownBrandToken("Kimirica - L&F"), "kimirica");

// shortlist: dedupe by pageId, drop own-brand pages, rank verified-then-likes.
const shortlisted = shortlistCandidates(
  [
    { pageId: "1", name: "Soch", category: null, likes: 100, verified: true },
    { pageId: "2", name: "Biba", category: "Clothing", likes: 50, verified: true },
    { pageId: "2", name: "Biba duplicate", category: null, likes: 999, verified: true },
    { pageId: "3", name: "FabIndia", category: null, likes: 200, verified: false },
  ],
  "Soch Apparels - 2022",
  10,
);
assert.deepEqual(shortlisted.map((c) => c.name), ["Biba", "FabIndia"], "own brand dropped, pageId deduped, verified ranked first");

console.log("PASS: brand profile parse checks");
