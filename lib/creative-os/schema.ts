// The Creative Intelligence Schema — the common object model the whole Creative Intelligence OS maps to.
//
// Non-negotiable rule (Master Phase Plan): define this FIRST, before any tool pipeline, so Apify / Reddit /
// Motion / Meta / reviews all feed ONE schema instead of becoming a disconnected pile of intelligence. Every
// external tool is a data provider into these objects; every internal engine reads them.
//
// This file is PURE (no I/O, no server-only) so the check and any layer can import it. The DB tables that
// persist these objects are proposed in supabase/migrations/0038_creative_intelligence_schema.sql (NOT yet
// applied — awaiting green-light). Existing tables are reused where they already hold an object (see below);
// only the two genuinely-missing spine objects (Pattern, Opportunity) get new tables.

// ─────────────────────────────────────────────────────────────────────────────
// 1. Where each plan object lives (reuse-first; new tables only for the real gaps)
// ─────────────────────────────────────────────────────────────────────────────
// Brand         → brands / brand_profiles / cp_brand_dna         (exists)
// Product       → cp_product_dna / shopify_products              (exists)
// Creative(own) → ad_meta + creative_semantics                   (exists)
// Performance   → ad_metrics + account_rollups/creative_rollups  (exists)
// Competitor    → competitor_brands / competitor_ads             (exists)
// Test          → decision_triples (prediction) + ad_metrics     (exists, partial)
// Learning      → decision_triples.outcome + account_verifications(exists, partial)
// Pattern       → creative_patterns                              (NEW — the spine)
// Opportunity   → opportunities                                  (NEW — the Opportunity Detection layer)
//
// Persona / Problem / Desire / Objection / Trigger / Angle / Hook / Visual Hook / Format / Language / Proof
//   are NOT separate tables — they are Pattern rows discriminated by `type` (below). One table, one taxonomy,
//   so pattern detection, the strategist, and opportunity detection all speak the same language.

// ─────────────────────────────────────────────────────────────────────────────
// 2. The pattern taxonomy (Pattern Extraction → Creative Database)
// ─────────────────────────────────────────────────────────────────────────────
export const PATTERN_TYPES = [
  "persona",
  "problem",
  "desire",
  "objection",
  "trigger",
  "angle",
  "hook",
  "visual_hook",
  "format",
  "language",
  "proof",
] as const;
export type PatternType = (typeof PATTERN_TYPES)[number];

// Where a pattern was observed. Grounds every pattern in a real, citable source (no fabricated personas).
export const PATTERN_SOURCES = ["own_ad", "competitor", "social", "review", "manual"] as const;
export type PatternSource = (typeof PATTERN_SOURCES)[number];

export type CreativePattern = {
  id: string;
  brandId: string | null; // null = category/market-level pattern (not brand-specific)
  type: PatternType;
  text: string; // the pattern itself, in real observed language (e.g. the actual hook line)
  source: PatternSource;
  sourceRef: string | null; // url / ad id / review id — provenance, so a claim is always traceable
  // Optional performance signal when the pattern is tied to a measured creative (fills over time via the loop).
  performance: { spend: number; roas: number | null; impressions: number } | null;
  // Free-form evidence the extractor kept (comment counts, engagement, transcript snippet, etc.).
  evidence: Record<string, unknown> | null;
  createdAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. The Opportunity object (Opportunity Detection → Strategist). The plan's key addition:
//    not "what worked?" but "given everything we know, what should we do next?"
// ─────────────────────────────────────────────────────────────────────────────
export const OPPORTUNITY_STATUSES = ["open", "in_concept", "testing", "won", "lost", "dismissed"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export type Opportunity = {
  id: string;
  brandId: string;
  // The creative territory: a persona × angle × format combination that the evidence says is worth pursuing.
  persona: string | null;
  angle: string | null;
  format: string | null;
  // The white-space thesis, in plain English (why this is an opportunity, not a guess).
  thesis: string;
  // Evidence + provenance: the pattern ids and category/competitor stats behind the thesis.
  evidence: { patternIds: string[]; note: string } | null;
  // Confidence 0..1 and the honest reason it isn't higher (mirrors the §110 Output Contract discipline).
  confidence: number;
  status: OpportunityStatus;
  createdAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Pure guards (gated by scripts/check-creative-os-schema.ts)
// ─────────────────────────────────────────────────────────────────────────────
export function isPatternType(v: string): v is PatternType {
  return (PATTERN_TYPES as readonly string[]).includes(v);
}
export function isPatternSource(v: string): v is PatternSource {
  return (PATTERN_SOURCES as readonly string[]).includes(v);
}
export function isOpportunityStatus(v: string): v is OpportunityStatus {
  return (OPPORTUNITY_STATUSES as readonly string[]).includes(v);
}
