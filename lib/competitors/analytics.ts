// Stages 4-6 (per-brand analytics) + the deterministic part of stage 8 (competitive
// engine). Pure functions over NormalizedAd[] - no I/O, no fabrication. Everything is a
// straight count or a set difference over real Ad Library ads; the LLM-written layers
// (42-attribute creative analysis, SWOT, written recommendations) are gated on Gemini and
// are NOT computed here.

import type { AnalyzedCreative, BrandAnalytics, BrandTraffic, CompetitorReport, Counted, MediaCategory, NormalizedAd } from "./types.ts";

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

export function analyzeBrand(ads: NormalizedAd[], nowUnix = 0): BrandAnalytics {
  // Ads launched in the last 7 days (only when a reference "now" is supplied; the check and
  // the live loader pass it, keeping the function pure/testable).
  const weekAgo = nowUnix - 7 * 86_400;
  const newLast7Days = nowUnix > 0 ? ads.filter((a) => a.startDate !== null && a.startDate >= weekAgo).length : 0;
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
    newLast7Days,
  };
}

// The landing-page host for one ad, lowercased and stripped of a leading "www.". Null when
// the link is missing or unparseable (those ads bucket to "Other", not a fake destination).
function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Bucket one landing-page host into a destination category.
function destinationOf(linkUrl: string | null): string {
  const host = hostOf(linkUrl);
  if (!host) return "Other";
  if (host === "apps.apple.com" || host === "play.google.com") return "App store";
  if (host.includes("amazon.")) return "Amazon";
  if (host.includes("flipkart.")) return "Flipkart";
  if (host.includes("myntra.")) return "Myntra";
  // ponytail: we do not store each brand's own domain, so any host that is NOT a known
  // marketplace/app-store is treated as the brand's own D2C site. Ceiling: this over-counts
  // "Own site" if a brand links to some other third party we do not list. Upgrade path =
  // store each brand's domain and match the host against it explicitly.
  return "Own site";
}

// Ad Traffic Distribution: per brand, where the ad clicks go, counted from each ad's
// landing-page host. Percentages are per brand (of that brand's ads with a link bucket).
// Only destinations that actually occur are returned, most-used first. My brand leads, then
// competitors by descending ad volume - matching buildCreativeIntel's ordering.
export function buildTrafficByBrand(ads: NormalizedAd[]): BrandTraffic[] {
  const byBrand = new Map<string, { label: string; isMyBrand: boolean; counts: Map<string, number>; total: number }>();
  for (const a of ads) {
    const row = byBrand.get(a.pageId) ?? { label: a.brandLabel, isMyBrand: a.isMyBrand, counts: new Map<string, number>(), total: 0 };
    const dest = destinationOf(a.linkUrl);
    row.counts.set(dest, (row.counts.get(dest) ?? 0) + 1);
    row.total += 1;
    byBrand.set(a.pageId, row);
  }
  return [...byBrand.values()]
    .map((r) => ({
      label: r.label,
      isMyBrand: r.isMyBrand,
      total: r.total,
      destinations: [...r.counts.entries()]
        .map(([label, count]) => ({ label, count, pct: r.total ? Math.round((count / r.total) * 100) : 0 }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => Number(b.isMyBrand) - Number(a.isMyBrand) || b.total - a.total)
    .map(({ total: _total, ...row }) => row);
}

// Group the flat ad list by brand (pageId) and analyze each. Insertion order of the first
// ad per brand is preserved so my brand keeps the position it arrived in.
export function buildReport(ads: NormalizedAd[], nowUnix = 0): CompetitorReport {
  const byBrand = new Map<string, NormalizedAd[]>();
  for (const ad of ads) {
    const list = byBrand.get(ad.pageId) ?? [];
    list.push(ad);
    byBrand.set(ad.pageId, list);
  }
  const brands = [...byBrand.values()].map((brandAds) => analyzeBrand(brandAds, nowUnix));
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
    trafficByBrand: buildTrafficByBrand(ads),
  };
}

// Stage 8 over the LLM Creative Intelligence Dataset: funnel (TOF/MOF/BOF) mix per brand,
// plus the hook-type / offer / emotion patterns across all analyzed creatives. Pure counts
// over the model's real reads - the written SWOT/recommendations remain a separate layer.
export type FunnelMix = { label: string; isMyBrand: boolean; tof: number; mof: number; bof: number; unknown: number };
export type CreativeIntel = {
  analyzedCount: number;
  funnelByBrand: FunnelMix[];
  hookTypes: Counted[];
  offers: Counted[];
  emotions: Counted[];
};

// Stage 8: "next creatives to test" - a factual, actionable list derived ONLY from real Ad
// Library counts (format/CTA gaps competitors run that you don't, plus competitor hooks you do
// not open with). No LLM, no fabrication: every recommendation names the real gap behind it.
export type CreativeRecommendation = { kind: "format" | "cta" | "hook"; value: string; reason: string };

export function buildRecommendations(report: CompetitorReport): CreativeRecommendation[] {
  const recs: CreativeRecommendation[] = [];
  const my = report.myBrand;
  if (!my) return recs; // recommendations are relative to YOUR brand; without it there is no gap

  // Format gaps: formats competitors run and you do not.
  for (const f of report.gaps.formats) {
    const n = report.competitors.filter((c) => c.formatMix[f] > 0).length;
    if (n > 0) recs.push({ kind: "format", value: f, reason: `${n} competitor${n === 1 ? "" : "s"} run ${f} ads; you run none. Test a ${f} creative.` });
  }
  // CTA gaps: CTAs competitors use and you do not.
  for (const cta of report.gaps.ctas.slice(0, 4)) {
    recs.push({ kind: "cta", value: cta, reason: `Competitors use the "${cta}" CTA; you do not. Test it.` });
  }
  // Hook opportunities: competitor opening hooks you do not use, ranked by how many ads use them.
  const myHooks = new Set((my.topHooks ?? []).map((h) => h.label.toLowerCase()));
  const compHooks = new Map<string, number>();
  for (const c of report.competitors) {
    for (const h of c.topHooks) {
      const key = h.label.toLowerCase();
      if (!myHooks.has(key)) compHooks.set(h.label, (compHooks.get(h.label) ?? 0) + h.count);
    }
  }
  for (const [hook, count] of [...compHooks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)) {
    recs.push({ kind: "hook", value: hook, reason: `Competitors open with "${hook}" (${count} ad${count === 1 ? "" : "s"}); you do not. Test that angle.` });
  }
  return recs.slice(0, 8);
}

// Competitor Voice: how the market talks, aggregated across the competitor set from their REAL
// ad copy. CTAs and opening hooks are deterministic counts (always available); the emotion / offer /
// hook-type layer comes from the Gemini creative analysis and is empty until some creatives are
// analyzed (analyzedCount === 0). Pure; no fabrication - every item is a count over real ads.
export type VoiceRead = {
  competitorAdCount: number;
  competitorBrandCount: number;
  competitorCtas: Counted[]; // CTAs the market uses, most-used first
  competitorHooks: Counted[]; // opening lines competitors lead with
  yourCtas: Counted[]; // your brand's CTAs, for contrast (empty when your brand is not in the set)
  ctaWhitespace: string[]; // CTAs competitors use that you do not
  emotions: Counted[]; // Gemini layer (empty until analyzed)
  offers: Counted[]; // Gemini layer (empty until analyzed)
  hookTypes: Counted[]; // Gemini layer (empty until analyzed)
  analyzedCount: number; // creatives Gemini has analyzed; 0 means the deeper layer is not unlocked yet
};

// Merge several Counted[] lists by summing counts per label, most-frequent first, keep top `limit`.
function mergeCounted(lists: Counted[][], limit: number): Counted[] {
  const m = new Map<string, number>();
  for (const list of lists) for (const c of list) m.set(c.label, (m.get(c.label) ?? 0) + c.count);
  return [...m.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function buildVoice(report: CompetitorReport, intel: CreativeIntel | null): VoiceRead {
  const comps = report.competitors;
  return {
    competitorAdCount: comps.reduce((s, c) => s + c.totalAds, 0),
    competitorBrandCount: comps.length,
    competitorCtas: mergeCounted(comps.map((c) => c.ctaMix), 8),
    competitorHooks: mergeCounted(comps.map((c) => c.topHooks), 8),
    yourCtas: report.myBrand ? report.myBrand.ctaMix : [],
    ctaWhitespace: report.gaps.ctas,
    emotions: intel?.emotions ?? [],
    offers: intel?.offers ?? [],
    hookTypes: intel?.hookTypes ?? [],
    analyzedCount: intel?.analyzedCount ?? 0,
  };
}

export function buildCreativeIntel(analyzed: AnalyzedCreative[]): CreativeIntel {
  const byBrand = new Map<string, { label: string; isMyBrand: boolean; tof: number; mof: number; bof: number; unknown: number }>();
  for (const c of analyzed) {
    const key = c.pageId;
    const row = byBrand.get(key) ?? { label: c.brandLabel, isMyBrand: c.isMyBrand, tof: 0, mof: 0, bof: 0, unknown: 0 };
    const stage = c.attributes.funnelStage;
    if (stage === "TOF") row.tof += 1;
    else if (stage === "MOF") row.mof += 1;
    else if (stage === "BOF") row.bof += 1;
    else row.unknown += 1;
    byBrand.set(key, row);
  }
  // My brand first, then competitors, each in descending analyzed volume.
  const funnelByBrand = [...byBrand.values()].sort(
    (a, b) => Number(b.isMyBrand) - Number(a.isMyBrand) || (b.tof + b.mof + b.bof) - (a.tof + a.mof + a.bof),
  );
  return {
    analyzedCount: analyzed.length,
    funnelByBrand,
    hookTypes: tally(analyzed.map((c) => c.attributes.hookType), 8),
    offers: tally(analyzed.map((c) => c.attributes.offer), 8),
    emotions: tally(analyzed.map((c) => c.attributes.primaryEmotion), 8),
  };
}
