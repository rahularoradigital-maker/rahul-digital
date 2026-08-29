// Creative Production — image-provider pricing + cost estimate. PURE (no I/O, no server-only) so it is
// gate-testable and shared by the Google adapter and the cost-control UI. USD/image from
// ai.google.dev/gemini-api/docs/pricing (~1K resolution).
import type { GenerationBrief, CostEstimate } from "@/lib/creative-production/types";

const PRICE: { match: string; usd: number }[] = [
  { match: "gemini-3-pro-image", usd: 0.134 },
  { match: "gemini-3.1-flash-lite-image", usd: 0.0336 },
  { match: "gemini-3.1-flash-image", usd: 0.067 },
  { match: "gemini-2.5-flash-image", usd: 0.039 },
];

export function priceFor(model: string): number {
  return PRICE.find((p) => model.startsWith(p.match))?.usd ?? 0.067;
}

export function estimateCost(briefs: GenerationBrief[], provider: string, model: string): CostEstimate {
  const usdPerImage = priceFor(model);
  return {
    assets: briefs.length,
    provider,
    model,
    usdPerImage,
    totalUsd: Math.round(briefs.length * usdPerImage * 1000) / 1000,
    estSeconds: briefs.length * 12,
  };
}
