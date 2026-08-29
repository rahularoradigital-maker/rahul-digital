// Runnable check for lib/creative-production/intelligence/brand-dna-merge.ts (pure Brand DNA merge).
// Run: node --experimental-strip-types scripts/check-cp-brand-merge.ts
import assert from "node:assert/strict";
import { mergeBrandDNA, emptyBrandDNA } from "../lib/creative-production/intelligence/brand-dna-merge.ts";
import type { BrandDNA } from "../lib/creative-production/types.ts";

const derived: BrandDNA = {
  palette: { primary: "#111111", secondary: "#222222", background: "#ffffff", text: "#000000" },
  fonts: { heading: "Poppins", body: "Inter" },
  logoUrl: "https://x/logo.png",
  imageStyle: "lifestyle",
  designStyle: "minimal",
  ctaStyle: "pill",
  tone: "warm",
  density: "medium",
  source: "derived",
  version: 3,
};

// 1) null override -> derived unchanged, source normalised to "derived".
const noOverride = mergeBrandDNA(derived, null);
assert.equal(noOverride.palette.primary, "#111111");
assert.equal(noOverride.tone, "warm");
assert.equal(noOverride.source, "derived");
assert.equal(noOverride.version, 3, "version is preserved");

// 2) partial override wins field-by-field; untouched fields fall through to derived.
const merged = mergeBrandDNA(derived, { palette: { primary: "#ff0000" }, tone: "bold" });
assert.equal(merged.palette.primary, "#ff0000", "override primary wins");
assert.equal(merged.palette.secondary, "#222222", "untouched palette falls through");
assert.equal(merged.tone, "bold", "override tone wins");
assert.equal(merged.fonts.heading, "Poppins", "untouched fonts fall through");
assert.equal(merged.source, "mixed", "any override marks the DNA mixed");

// 3) reset semantics: dropping the override returns to derived exactly (lossless).
const afterReset = mergeBrandDNA(derived, null);
assert.deepEqual(afterReset.palette, derived.palette);
assert.deepEqual(afterReset.fonts, derived.fonts);

// 4) emptyBrandDNA is a safe all-UNKNOWN starting point that still merges.
const empty = emptyBrandDNA();
assert.equal(empty.palette.primary, "UNKNOWN");
const filledFromEmpty = mergeBrandDNA(empty, { palette: { primary: "#00ff00" } });
assert.equal(filledFromEmpty.palette.primary, "#00ff00");
assert.equal(filledFromEmpty.palette.text, "UNKNOWN", "unset stays UNKNOWN");

console.log("PASS: check-cp-brand-merge");
