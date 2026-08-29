// Generation-brief content hash (Phase 7) — PURE, no I/O. Two briefs that would produce the SAME
// image must hash the same, so an identical brief is a cache hit and we never pay to regenerate it.
// The hash covers only the fields that DETERMINE the output; anything cosmetic/derived is left out.

import type { GenerationBrief } from "@/lib/creative-production/types";

// FNV-1a 32-bit -> 8 hex chars. Copied inline from lib/creative/fingerprint.ts (kept dependency-free
// and self-contained). Deterministic and stable across runs/machines (unlike Object/JSON key order).
// Not cryptographic: it's an identity/cache key, not a security primitive.
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // h *= 16777619 in 32-bit range
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// Sort array fields before hashing so ORDER doesn't matter where it shouldn't (e.g. a restrictions
// list is a set of rules, not a sequence — reordering it must not bust the cache).
function sortedCopy(arr: readonly string[]): string[] {
  return [...arr].sort();
}

// Build the canonical, order-stable payload of ONLY the output-determining fields.
function canonicalPayload(brief: GenerationBrief): unknown[] {
  const { brandDNA, productDNA, format, concept } = brief;
  return [
    // Brand DNA that affects pixels: palette, fonts, visual style.
    brandDNA.palette.primary,
    brandDNA.palette.secondary,
    brandDNA.palette.background,
    brandDNA.palette.text,
    brandDNA.fonts.heading,
    brandDNA.fonts.body,
    brandDNA.imageStyle,
    brandDNA.designStyle,
    // Product identity + reference images (sorted: same set = same brief).
    productDNA.productId,
    sortedCopy(productDNA.images),
    // Format identity.
    format.id,
    // Concept fields that drive the composed creative.
    concept.id,
    concept.headline,
    concept.cta,
    concept.offer,
    concept.visualDirection,
    // Request + guardrails + prompt version.
    brief.aspectRatioRequest,
    sortedCopy(brief.restrictions),
    brief.promptVersion,
  ];
}

// Stable content hash: identical briefs -> same 8-hex string (cache hit = no regeneration).
export function briefHash(brief: GenerationBrief): string {
  // JSON of the canonical payload; arrays inside are pre-sorted so key/element order is fixed.
  return fnv1a(JSON.stringify(canonicalPayload(brief)));
}

export function briefsAreEqual(a: GenerationBrief, b: GenerationBrief): boolean {
  return briefHash(a) === briefHash(b);
}
