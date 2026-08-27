// Stages 4-6 (per-brand analytics) + the deterministic part of stage 8 (competitive
// engine). Pure functions over NormalizedAd[] - no I/O, no fabrication. Everything is a
// straight count or a set difference over real Ad Library ads; the LLM-written layers
// (42-attribute creative analysis, SWOT, written recommendations) are gated on Gemini and
// are NOT computed here.

import type { BrandAnalytics, CompetitorReport, Counted, MediaCategory, NormalizedAd } from "./types.ts";

const EMPTY_MIX: Record<MediaCategory, number> = { video: 0, image: 0, carousel: 0, other: 0 };

// Count by key, drop empties, sort most-frequent first, keep the top `limit`.
function tally(values: (string | null | undefined)[], limit: number): Counted[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = (v ?? "").trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

// The opening line of the body copy - the "hook" - normalized to group near-duplicates.
function hookOf(ad: NormalizedAd): string | null {
  if (!ad.body) return null;
  const firstLine = ad.body.split(/\r?\n/)[0].trim();
  const clipped = firstLine.length > 80 ? `${firstLine.slice(0, 80)}...` : firstLine;
  return clipped || null;
}

export function analyzeBrand(ads: NormalizedAd[]): BrandAnalytics {
  const label = ads[0]?.brandLabel ?? "Unknown";
  const pageId = ads[0]?.pageId ?? "";
  const isMyBrand = ads[0]?.isMyBrand ?? false;

  const formatMix = { ...EMPTY_MIX };
  for (const ad of ads) formatMix[ad.media] += 1;

  const activeAds = ads.filter((a) => a.isActive).length;

  // Top creatives: active ones first, then most recent by start date, capped at 10.
  const topCreatives = [...ads]
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || (b.startDate ?? 0) - (a.startDate ?? 0))
    .slice(0, 10);

  return {
    label,
    pageId,
    isMyBrand,
    totalAds: ads.length,
    activeAds,
    inactiveAds: ads.length - activeAds,
    formatMix,
    ctaMix: tally(ads.map((a) => a.ctaText), 6),
    platformMix: tally(ads.flatMap((a) => a.platforms), 6),
    topHooks: tally(ads.map(hookOf), 8),
    topCreatives,
  };
}

// Group the flat ad list by brand (pageId) and analyze each. Insertion order of the first
// ad per brand is preserved so my brand keeps the position it arrived in.
export function buildReport(ads: NormalizedAd[]): CompetitorReport {
  const byBrand = new Map<string, NormalizedAd[]>();
  for (const ad of ads) {
    const list = byBrand.get(ad.pageId) ?? [];
    list.push(ad);
    byBrand.set(ad.pageId, list);
  }
  const brands = [...byBrand.values()].map(analyzeBrand);
  const myBrand = brands.find((b) => b.isMyBrand) ?? null;
  const competitors = brands.filter((b) => !b.isMyBrand);

  // Whitespace = formats/CTAs competitors use that my brand does not (deterministic gap).
  const myFormats = new Set<MediaCategory>(
    myBrand ? (Object.keys(myBrand.formatMix) as MediaCategory[]).filter((k) => myBrand.formatMix[k] > 0) : [],
  );
  const myCtas = new Set<string>(myBrand ? myBrand.ctaMix.map((c) => c.label) : []);
  const compFormats = new Set<MediaCategory>();
  const compCtas = new Set<string>();
  for (const c of competitors) {
    (Object.keys(c.formatMix) as MediaCategory[]).forEach((k) => {
      if (c.formatMix[k] > 0) compFormats.add(k);
    });
    c.ctaMix.forEach((cta) => compCtas.add(cta.label));
  }

  return {
    myBrand,
    competitors,
    gaps: {
      formats: myBrand ? [...compFormats].filter((f) => !myFormats.has(f)) : [],
      ctas: myBrand ? [...compCtas].filter((c) => !myCtas.has(c)) : [],
    },
  };
}
