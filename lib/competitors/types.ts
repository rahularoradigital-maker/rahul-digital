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

export type CompetitorReport = {
  myBrand: BrandAnalytics | null;
  competitors: BrandAnalytics[];
  // Whitespace: formats and CTAs competitors run that my brand does not (stage 8 gap
  // analysis, the deterministic part - the LLM-written recommendations are gated on Gemini).
  gaps: { formats: MediaCategory[]; ctas: string[] };
};
