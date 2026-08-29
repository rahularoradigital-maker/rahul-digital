// Creative diversity vs competitors. The own-only diversity read (assessDiversity) answers
// "how concentrated is MY format mix". This answers the next question the brief asks: "how does
// my format mix compare to the competitors already scraped from the public Ad Library, and where
// is the gap?" Pure, no I/O, no fabrication.
//
// Two sides, two different denominators, kept honest and separate:
//   OWN side       = share of MY spend per format (real Meta spend, from assessDiversity buckets).
//   COMPETITOR side = share of competitor ADS per format, from the public Ad Library. A competitor's
//                     spend/ROAS is NEVER exposed by Meta, so we only ever count PRESENCE (how many
//                     of their creatives run a format), never imply we know what those ads earn.
//
// CRITICAL (per research): the Ad Library re-uploads the SAME creative under many ad archive IDs,
// which inflates a raw count. We DEDUPE competitor ads by (page + creative asset) BEFORE counting,
// so "40% video" means 40% of distinct creatives, not 40% of re-upload rows. Ratios are null on a
// zero denominator, never a fabricated 0.

import type { BucketStat } from "./diversity.ts";

// The minimal shape the comparison needs. NormalizedAd (lib/competitors/types) is assignable to it,
// so callers pass stored Ad Library ads straight in without a mapping layer.
export type CompetitorAdLike = {
  pageId: string;
  adArchiveId: string;
  media: string; // video | image | carousel | other (any string is bucketed as-is)
  isMyBrand?: boolean;
  videoUrl?: string | null;
  imageUrl?: string | null;
  title?: string | null;
  body?: string | null;
};

export type FormatComparison = {
  format: string;
  ownShare: number | null; // share of my SPEND (0..1), null only when I have no ads at all
  competitorShare: number | null; // share of distinct competitor ADS (0..1), null only when they have none
  gap: boolean; // competitors over-index this format vs me by a meaningful margin
  overConcentration: boolean; // I over-index this format in absolute terms
  note: string;
};

export type DiversityComparison = {
  formats: FormatComparison[];
  gaps: string[]; // human-readable gap flags, biggest first
  overConcentration: string[]; // human-readable over-concentration flags, biggest first
  suggestion: string | null; // ONE deterministic "where to diversify" line, grounded only in the numbers
  competitorBrandCount: number;
  competitorAdsRaw: number; // rows before dedupe
  competitorAdsDeduped: number; // distinct creatives counted
  duplicatesRemoved: number;
  label: "INTERNAL CALCULATION";
  basis: string;
};

// --- Calibrate-at-build constants (tune once real accounts are observed). ---
const GAP_MIN_DELTA = 0.2; // competitors must run a format >=20 points more than me to flag a gap
const GAP_MIN_PRESENCE = 0.2; // and it must be >=20% of their mix (a format they actually lean on)
const OVERCONC_MIN = 0.6; // >=60% of my spend in one format = over-concentrated (single point of failure)

const FORMAT_ORDER = ["video", "image", "carousel", "catalog", "other", "unknown"];

function pctInt(share: number): number {
  return Math.round(share * 100);
}

// The stable identity of ONE creative asset, used to collapse Ad Library re-uploads. Prefer the
// asset URL's PATH (the host + query carry rotating CDN tokens that differ per row for the same
// file); fall back to the ad copy, then to the archive id so genuinely distinct ads with no shared
// signal are never merged.
// ponytail: path-equality is a heuristic - a re-encode under a new path reads as a new creative
// (under-merges, safe), and two different assets sharing a path would over-merge (not observed on
// Meta's CDN). Upgrade path = a perceptual/content hash of the fetched asset.
function assetKey(a: CompetitorAdLike): string {
  const url = a.videoUrl || a.imageUrl;
  if (url) {
    try {
      return `asset:${new URL(url).pathname}`;
    } catch {
      return `asset:${url}`;
    }
  }
  const copy = `${a.title ?? ""}\n${a.body ?? ""}`.trim().toLowerCase();
  if (copy) return `copy:${copy}`;
  return `id:${a.adArchiveId}`;
}

// Dedupe competitor ads to one representative per (page + creative asset). First occurrence wins,
// so the representative keeps a real row's media/fields (never a synthesized one).
export function dedupeCompetitorAds(ads: CompetitorAdLike[]): CompetitorAdLike[] {
  const seen = new Map<string, CompetitorAdLike>();
  for (const a of ads) {
    const key = `${a.pageId}|${assetKey(a)}`;
    if (!seen.has(key)) seen.set(key, a);
  }
  return [...seen.values()];
}

function orderIndex(format: string): number {
  const i = FORMAT_ORDER.indexOf(format);
  return i === -1 ? FORMAT_ORDER.length : i;
}

// Compare my format mix (from assessDiversity's "format" dimension buckets) against the competitor
// ad set. Returns null when there is nothing real to compare (no competitor ads, or no own formats)
// so the UI can show a quiet "add competitors" note instead of a fabricated zero comparison.
export function compareDiversityToCompetitors(
  ownFormatBuckets: Pick<BucketStat, "name" | "spendShare" | "count">[],
  competitorAds: CompetitorAdLike[],
): DiversityComparison | null {
  const comps = competitorAds.filter((a) => a.isMyBrand !== true);
  const rawCount = comps.length;
  const deduped = dedupeCompetitorAds(comps);
  const compTotal = deduped.length;
  const ownTotal = ownFormatBuckets.reduce((s, b) => s + b.count, 0);
  if (compTotal === 0 || ownTotal === 0) return null;

  const ownShareByFormat = new Map<string, number>();
  for (const b of ownFormatBuckets) ownShareByFormat.set(b.name, b.spendShare);

  const compCountByFormat = new Map<string, number>();
  for (const a of deduped) compCountByFormat.set(a.media, (compCountByFormat.get(a.media) ?? 0) + 1);

  const formats = [...new Set([...ownShareByFormat.keys(), ...compCountByFormat.keys()])].sort(
    (a, b) => orderIndex(a) - orderIndex(b) || a.localeCompare(b),
  );

  const gaps: { text: string; delta: number }[] = [];
  const over: { text: string; share: number }[] = [];

  const rows: FormatComparison[] = formats.map((format) => {
    // Denominators are > 0 here (guarded above), so a format the side simply does not run is a REAL
    // 0, not null. Null is reserved for a genuinely absent denominator.
    const ownShare = ownTotal > 0 ? (ownShareByFormat.get(format) ?? 0) : null;
    const competitorShare = compTotal > 0 ? (compCountByFormat.get(format) ?? 0) / compTotal : null;

    let gap = false;
    let overConcentration = false;
    if (ownShare !== null && competitorShare !== null) {
      gap = competitorShare - ownShare >= GAP_MIN_DELTA && competitorShare >= GAP_MIN_PRESENCE;
      overConcentration = ownShare >= OVERCONC_MIN;
      if (gap) gaps.push({ text: `Competitors run ${pctInt(competitorShare)}% ${format}, you run ${pctInt(ownShare)}%`, delta: competitorShare - ownShare });
      if (overConcentration) over.push({ text: `You are ${pctInt(ownShare)}% ${format}`, share: ownShare });
    }

    const note =
      ownShare === null || competitorShare === null
        ? `Not enough data to compare ${format}.`
        : `You ${pctInt(ownShare)}% of spend vs competitors ${pctInt(competitorShare)}% of ads.`;

    return { format, ownShare, competitorShare, gap, overConcentration, note };
  });

  gaps.sort((a, b) => b.delta - a.delta);
  over.sort((a, b) => b.share - a.share);

  // ONE deterministic "where to diversify" line, grounded ONLY in the computed numbers. A real gap
  // (a format competitors lean on that you barely run) is the strongest signal; failing that, an
  // over-concentration is the risk to call out. Never invented, never an LLM number.
  let suggestion: string | null = null;
  if (gaps.length > 0) {
    const top = rows.find((r) => r.gap)!;
    suggestion = `Test a ${top.format} creative: competitors run ${pctInt(top.competitorShare!)}% ${top.format}, you run ${pctInt(top.ownShare!)}%.`;
  } else if (over.length > 0) {
    const top = rows.filter((r) => r.overConcentration).sort((a, b) => (b.ownShare ?? 0) - (a.ownShare ?? 0))[0];
    suggestion = `You concentrate ${pctInt(top.ownShare!)}% of spend in ${top.format}; test another format to cut concentration risk.`;
  }

  const competitorBrandCount = new Set(deduped.map((a) => a.pageId)).size;
  const duplicatesRemoved = rawCount - compTotal;
  const basis =
    `Your format mix (share of spend) vs ${competitorBrandCount} competitor brand${competitorBrandCount === 1 ? "" : "s"}: ` +
    `${compTotal} distinct competitor creative${compTotal === 1 ? "" : "s"} from the Ad Library` +
    (duplicatesRemoved > 0 ? ` (${duplicatesRemoved} duplicate re-upload${duplicatesRemoved === 1 ? "" : "s"} removed).` : ".");

  return {
    formats: rows,
    gaps: gaps.map((g) => g.text),
    overConcentration: over.map((o) => o.text),
    suggestion,
    competitorBrandCount,
    competitorAdsRaw: rawCount,
    competitorAdsDeduped: compTotal,
    duplicatesRemoved,
    label: "INTERNAL CALCULATION",
    basis,
  };
}
