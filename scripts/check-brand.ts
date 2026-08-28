// Runnable check for lib/brand/parse.ts (pure brand-profile parsing).
// Run: node --experimental-strip-types scripts/check-brand.ts
import assert from "node:assert/strict";
import { parseDerived } from "../lib/brand/parse.ts";

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

console.log("PASS: brand profile parse checks");
