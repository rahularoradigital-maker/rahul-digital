// Runnable check for lib/creative-production/shopify/search.ts (product-search query sanitizer).
// Run: node --experimental-strip-types scripts/check-cp-search.ts
import assert from "node:assert/strict";
import { sanitizeSearchTerm } from "../lib/creative-production/shopify/search.ts";

// 1) PostgREST/ilike metacharacters are stripped so a query can't break the .or() grammar or widen the match.
for (const ch of [",", "(", ")", "%", "*", "\\"]) {
  const out = sanitizeSearchTerm(`ab${ch}cd`);
  assert.ok(!out.includes(ch), `metachar ${JSON.stringify(ch)} removed`);
}
// A crafted injection attempt loses every dangerous character.
const evil = sanitizeSearchTerm("x,title.ilike.%,y)(%*\\");
for (const ch of [",", "(", ")", "%", "*", "\\"]) assert.ok(!evil.includes(ch), `evil input stripped of ${ch}`);

// 2) Ordinary searches pass through intact (letters, digits, spaces, hyphen).
assert.equal(sanitizeSearchTerm("  Airdopes 141  "), "Airdopes 141", "trimmed, inner text kept");
assert.equal(sanitizeSearchTerm("boAt Stone-190"), "boAt Stone-190", "letters/digits/hyphen kept");

// 3) Length is capped at 80.
assert.equal(sanitizeSearchTerm("a".repeat(200)).length, 80, "capped to 80 chars");

// 4) Null/empty safe.
assert.equal(sanitizeSearchTerm(""), "");
assert.equal(sanitizeSearchTerm(undefined as unknown as string), "");

console.log("PASS: check-cp-search (query sanitizer: metachars stripped, real text kept, length-capped, null-safe)");
