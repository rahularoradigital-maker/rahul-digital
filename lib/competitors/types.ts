// Shared shapes for the competitor-intelligence pipeline (diagram stages 2-9). A
// NormalizedAd is one Facebook Ad Library ad after processing (stage 3); the analytics
// (stages 4-6) and the competitive report (stages 8-9) are computed from a list of them.
// Everything here is derived from REAL Ad Library data - no fabricated fields.

export type MediaCategory = "video" | "image" | "carousel" | "other";

export type NormalizedAd = {
  pageId: string;
  adArchiveId: string;
  brandLabel: string; // page name or the label the user gave the brand
  isMyBrand: boolean;
  isActive: boolean;
  displayFormat: string; // raw Meta display_format (VIDEO / IMAGE / DCO / DPA ...)
  media: MediaCategory; // normalized bucket for the format mix
  ctaText: string | null;
  ctaType: string | null;
  title: string | null;
  body: string | null;
  linkUrl: string | null;
  platforms: string[]; // FACEBOOK / INSTAGRAM / MESSENGER / AUDIENCE_NETWORK
  startDate: number | null; // unix seconds
  endDate: number | null;
  cardCount: number; // >1 means a multi-card (carousel) creative
  adUrl: string | null; // permalink into the Ad Library for this ad
  imageUrl: string | null; // best still image (for the LLM to read + a thumbnail)
  videoUrl: string | null; // best video file, when the creative is a video
  videoThumbUrl: string | null; // a video's preview frame
};

// The LLM Creative Analysis output (diagram stage 7): the 42-attribute set + funnel
// classification for one creative. Written by the Gemini layer, read by stages 8-9.
// funnelStage is TOF / MOF / BOF. Every field is the model's read of a REAL creative.
export type CreativeAttributes = {
  funnelStage: "TOF" | "MOF" | "BOF" | null;
  hook: string | null;
  hookType: string | null;
  firstThreeSeconds: string | null;
  messaging: string | null;
  offer: string | null;
  cta: string | null;
  productVsHuman: string | null;
  creatorTraits: string | null;
  voiceAudio: string | null;
  visualScene: string | null;
  colorTypography: string | null;
  branding: string | null;
  painPoint: string | null;
  benefit: string | null;
  primaryEmotion: string | null;
  socialProof: string | null;
  storytelling: string | null;
  editingPacing: string | null;
  closing: string | null;
  conversionIntent: string | null;
  notes: string | null;
};

export type AnalyzedCreative = {
  adArchiveId: string;
  pageId: string;
  brandLabel: string;
  isMyBrand: boolean;
  attributes: CreativeAttributes;
};

export type Counted = { label: string; count: number };

export type BrandAnalytics = {
  label: string;
  pageId: string;
  isMyBrand: boolean;
  totalAds: number;
  activeAds: number;
  inactiveAds: number;
  formatMix: Record<MediaCategory, number>;
  ctaMix: Counted[]; // most-used CTA first
  platformMix: Counted[]; // most-used platform first
  topHooks: Counted[]; // most-repeated opening line first
  topCreatives: NormalizedAd[]; // active first, then most recent, up to 10
};

// Ad traffic distribution: where a brand sends its ad clicks, bucketed from each ad's
// landing-page host (own D2C site vs the big marketplaces / app stores). Counts + percentages.
export type TrafficDestination = { label: string; count: number; pct: number };
export type BrandTraffic = { label: string; isMyBrand: boolean; destinations: TrafficDestination[] };

export type CompetitorReport = {
  myBrand: BrandAnalytics | null;
  competitors: BrandAnalytics[];
  // Whitespace: formats and CTAs competitors run that my brand does not (stage 8 gap
  // analysis, the deterministic part - the LLM-written recommendations are gated on Gemini).
  gaps: { formats: MediaCategory[]; ctas: string[] };
  // Where each brand sends its ad clicks, from the stored landing-page URLs.
  trafficByBrand: BrandTraffic[];
};
