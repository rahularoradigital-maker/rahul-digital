// Creative Production — SHARED TYPE CONTRACT. Every module in lib/creative-production imports from here so
// the pipeline (Shopify → Product DNA → Brand DNA → Concept → Brief → Image → Compose → QA → Asset) stays
// type-consistent. Pure types only (no I/O). See docs/plans/creative-production-engine.md.

// ---------- Product Intelligence (Phase 3) ----------
// Every derived field may be the literal "UNKNOWN" - we never invent product claims.
export type Unknown = "UNKNOWN";
export type ProductDNA = {
  productId: string;
  name: string;
  category: string | Unknown;
  primaryBenefit: string | Unknown;
  secondaryBenefits: string[];
  problemSolved: string | Unknown;
  targetPersona: string | Unknown;
  useCase: string | Unknown;
  keyIngredients: string[];
  differentiators: string[];
  usps: string[];
  proof: string[]; // reviews/ratings/claims that are actually present in the source
  claims: string[];
  offerEligibility: string | Unknown;
  price: number | null;
  discount: number | null; // compareAt - price, when present
  images: string[];
  url: string | null;
  brandRelevance: string | Unknown;
  creativeOpportunities: string[];
  creativeRestrictions: string[];
  confidence: number; // 0..1, how grounded the read is
};

// ---------- Brand DNA (Phase 4) ----------
export type BrandPalette = { primary: string | Unknown; secondary: string | Unknown; background: string | Unknown; text: string | Unknown };
export type BrandFonts = { heading: string | Unknown; body: string | Unknown };
export type BrandDNA = {
  palette: BrandPalette;
  fonts: BrandFonts;
  logoUrl: string | null;
  imageStyle: string | Unknown; // photography / illustration / flat / lifestyle
  designStyle: string | Unknown; // minimal / dense / editorial
  ctaStyle: string | Unknown; // pill / square / underline
  tone: string | Unknown;
  density: "low" | "medium" | "high" | Unknown;
  source: "derived" | "override" | "mixed";
  version: number;
};
// A user override is a partial Brand DNA; the effective DNA = merge(derived, override). Reset drops override.
export type BrandDNAOverride = Partial<Pick<BrandDNA, "palette" | "fonts" | "logoUrl" | "imageStyle" | "designStyle" | "ctaStyle" | "tone" | "density">>;

// ---------- Creative concept / format (Phase 5) ----------
export type AwarenessStage = "unaware" | "problem" | "solution" | "product" | "most_aware";
// A format archetype from the library (70-80). Structure describes the slots the composition fills.
export type ConceptFormat = {
  id: string; // kebab id, e.g. "before-after"
  name: string;
  awarenessStage: AwarenessStage;
  structure: string; // one line: how the layout reads
  textSlots: ("headline" | "subhead" | "body" | "cta" | "offer" | "stat" | "quote" | "rating")[];
  visualPattern: string; // what the AI visual should depict
  bestFor: string; // when to pick this format
};
// A concrete, product-specific concept (ranked, justified).
export type CreativeConcept = {
  id: string;
  productId: string;
  formatId: string;
  persona: string;
  problem: string;
  desire: string;
  awarenessStage: AwarenessStage;
  hook: string;
  angle: string;
  coreMessage: string;
  visualDirection: string;
  headline: string;
  supportingCopy: string;
  cta: string;
  offer: string | null;
  whyThisConcept: string;
  whyNow: string;
  evidence: string[];
  confidence: number; // 0..1
  score: number; // ranking score (deterministic, from the strategy engine)
};

// Signals the strategy engine multiplies (each 0..1). Sourced from AdBrain's existing intelligence.
export type StrategySignals = {
  productOpportunity: number;
  creativeWhiteSpace: number;
  audienceNeed: number;
  historicalPerformance: number;
  formatSuitability: number;
  brandFit: number;
};

// ---------- Ad formats (Phase 7) ----------
export type Platform = "meta" | "google";
export type AdFormat = {
  id: string; // e.g. "meta-feed-1x1"
  platform: Platform;
  name: string;
  width: number;
  height: number;
  aspectRatio: string; // "1:1"
  purpose: string;
  safeZone: { top: number; right: number; bottom: number; left: number }; // fractions 0..1 of each edge
  textConstraints: string;
  exportFormat: "png" | "jpg";
  version: string;
  source: string; // doc URL the dims came from
};

// ---------- Generation brief (Phase 7) — what the image provider consumes ----------
export type GenerationBrief = {
  brandDNA: BrandDNA;
  productDNA: Pick<ProductDNA, "productId" | "name" | "images" | "price" | "discount">;
  format: AdFormat;
  concept: Pick<CreativeConcept, "id" | "formatId" | "hook" | "angle" | "headline" | "supportingCopy" | "cta" | "offer" | "visualDirection">;
  aspectRatioRequest: string; // native ratio to ask the model for (1.91:1 -> "16:9" then crop)
  restrictions: string[];
  requiredProductFidelity: boolean;
  negativeInstructions: string[];
  referenceImages: string[]; // product image urls to preserve fidelity
  promptVersion: string;
};

// ---------- Image provider abstraction (Phase 6) ----------
export type ProviderCapabilities = { generation: boolean; editing: boolean; referenceImages: number; aspectRatios: string[]; maxResolution: string };
export type CostEstimate = { assets: number; provider: string; model: string; usdPerImage: number; totalUsd: number; estSeconds: number };
export type GenerationResult = {
  ok: boolean;
  imageBase64?: string;
  mimeType?: string;
  provider: string;
  model: string;
  costUsd: number;
  promptVersion: string;
  error?: string;
};
export interface ImageProvider {
  readonly name: string;
  getCapabilities(): ProviderCapabilities;
  getCostEstimate(briefs: GenerationBrief[]): CostEstimate;
  generateCreative(brief: GenerationBrief): Promise<GenerationResult>;
  editCreative(brief: GenerationBrief, baseImageBase64: string): Promise<GenerationResult>;
  generateVariant(brief: GenerationBrief, parentImageBase64: string): Promise<GenerationResult>;
  getGenerationStatus(id: string): Promise<"pending" | "done" | "failed" | "unknown">;
}

// ---------- Composition + QA + asset (Phases 8-10) ----------
// The composed creative is a deterministic SVG (exact, misspelling-free text over the AI visual).
// PNG export is done in the browser at download time (canvas.toBlob) so we ship no server raster dep.
export type ComposedAsset = { formatId: string; width: number; height: number; svg: string };
export type QACheck = { name: string; pass: boolean; severity: "critical" | "warning"; detail: string };
export type QAResult = { status: "READY" | "FAILED" | "REVIEW"; checks: QACheck[] };
export type ApprovalStatus = "draft" | "approved" | "rejected" | "review";
export type CreativeAssetRecord = {
  creativeId: string;
  version: number;
  parentCreativeId: string | null;
  conceptId: string;
  productId: string;
  generationId: string;
  formatId: string;
  provider: string;
  model: string;
  promptVersion: string;
  brandDnaVersion: number;
  productDnaVersion: number;
  storagePath: string;
  qa: QAResult;
  approval: ApprovalStatus;
  costUsd: number;
  createdAt: string;
};
