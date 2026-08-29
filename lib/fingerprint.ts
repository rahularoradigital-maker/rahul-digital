// FUTURE / not-yet-wired SEMANTIC layer (ISSUE 18). This is NOT the production fingerprint - the live
// path uses lib/creative/fingerprint.ts (deterministic content-hash facts) + lib/creative/diversity.ts.
// This file is the spec-05 SEMANTIC representation + similarity primitive, exercised only by
// scripts/check-diversity.ts; nothing in app/ or the live pipeline imports it yet. Kept as the designed
// seam for when embedding-based similarity is productionized (it would plug in behind
// lib/creative/diversity.ts, not replace the deterministic fingerprint). Do not build a second
// production path here - for creative facts in the app, use lib/creative/fingerprint.ts.
//
// Creative fingerprint types + similarity primitive (spec 05).
// The fingerprint is the per-creative semantic representation, computed once per
// content_hash and reused forever. Labels are INFERENCE (spec 05 §6): a dimension
// that cannot be grounded is null, NEVER a guessed value — a guessed label silently
// corrupts diversity/white-space (spec 05 §2).
//
// Similarity here is the label-agreement basis of spec 05 §7.2. Embedding-cosine
// similarity arrives later BEHIND THIS SAME SEAM (same signature, richer inputs);
// callers (lib/rules/diversity.ts) never need to change.

/**
 * The 11 semantic dimensions of spec 05 §2, in schema-field naming.
 * (Spec 06 §0.1 lists an extended 19-dim set — awareness, CTA, narrative, … —
 * as extensible label rows; those are NOT part of the core fingerprint type.)
 */
export const FINGERPRINT_DIMENSIONS = [
  "persona", // who the creative speaks to
  "problem", // the pain/tension the ad names
  "desire", // the wanted end-state / benefit promised
  "hook", // the opening device (first ~3s)
  "angle", // the persuasion strategy
  "format", // structural type (UGC, static, carousel, ...)
  "visual_style", // aesthetic register
  "speaker", // who delivers it
  "product", // which SKU/product line is featured
  "offer", // the deal/CTA proposition
  "landing", // where the click goes + message-match (EXTERNAL; null without LP crawl)
] as const;

export type FingerprintDimension = (typeof FINGERPRINT_DIMENSIONS)[number];

/**
 * One creative's fingerprint. Each dimension is a controlled-vocabulary label or
 * null (= not extracted / not applicable — a data gap, never a finding).
 * `contentHash` ties the fingerprint to content, not the churny Meta creative id
 * (fingerprint-once, spec 05 §4/§8). `confidence` holds the per-dimension `_conf`
 * of each extracted label (spec 05 §2: every label is INFERENCE with confidence).
 */
export type CreativeFingerprint = {
  [K in FingerprintDimension]: string | null;
} & {
  creativeId: string;
  contentHash: string;
  extractedAt: string; // ISO timestamp of extraction
  confidence: Record<string, number>; // per-dimension extraction confidence, 0..1
};

export type SimilarityResult =
  | { status: "ok"; score: number; sharedDimensions: number }
  | { status: "insufficient_data" };

/**
 * Minimum dimensions both fingerprints must have non-null before a similarity
 * score is honest. Below this, agreement is noise (2 matching labels out of 2
 * comparable is not "identical ideas"). Floor value is calibrate-at-build
 * (spec 05 §7.2 min sample; no invented threshold ships as fact).
 */
const MIN_COMPARABLE_DIMENSIONS = 4;

/**
 * Label-agreement similarity of two creatives as IDEAS (spec 05 §7.2 basis).
 * score = matching dimensions / dimensions both have non-null, in 0..1.
 * Null dimensions are excluded — a missing label is a data gap, not disagreement.
 * Fewer than MIN_COMPARABLE_DIMENSIONS comparable → insufficient_data, never a
 * fabricated score. The verdict at any threshold is a MODEL ESTIMATE (spec 05 §6).
 */
export function similarity(a: CreativeFingerprint, b: CreativeFingerprint): SimilarityResult {
  let comparable = 0;
  let matches = 0;
  for (const dim of FINGERPRINT_DIMENSIONS) {
    const av = a[dim];
    const bv = b[dim];
    if (av === null || bv === null) continue;
    comparable++;
    if (av === bv) matches++;
  }
  if (comparable < MIN_COMPARABLE_DIMENSIONS) return { status: "insufficient_data" };
  return { status: "ok", score: matches / comparable, sharedDimensions: comparable };
}
