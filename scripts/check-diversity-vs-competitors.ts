// One runnable check for the own-vs-competitor creative diversity comparison. No frameworks,
// no network - pure functions over fixtures. Covers the CRITICAL dedupe of Ad Library re-uploads,
// null-on-zero-denominator, gap detection, over-concentration, and the deterministic suggestion.
// Run: node --experimental-strip-types scripts/check-diversity-vs-competitors.ts
import assert from "node:assert/strict";
import { compareDiversityToCompetitors, dedupeCompetitorAds, type CompetitorAdLike } from "../lib/creative/diversity-vs-competitors.ts";

function ad(over: Partial<CompetitorAdLike>): CompetitorAdLike {
  return { pageId: "P1", adArchiveId: Math.random().toString(36).slice(2), media: "video", isMyBrand: false, videoUrl: null, imageUrl: null, title: null, body: null, ...over };
}

// --- 1) DEDUPE: the same creative re-uploaded under many ad IDs must count ONCE. ---
// Three rows share one video asset path (with rotating CDN query tokens); one distinct image.
const reuploads = [
  ad({ adArchiveId: "1", videoUrl: "https://cdn.fb/vid/abc.mp4?token=aaa" }),
  ad({ adArchiveId: "2", videoUrl: "https://cdn.fb/vid/abc.mp4?token=bbb" }), // same path, new token -> dupe
  ad({ adArchiveId: "3", videoUrl: "https://other.cdn/vid/abc.mp4" }), // same path on a rotated host -> dupe
  ad({ adArchiveId: "4", media: "image", imageUrl: "https://cdn.fb/img/xyz.jpg?token=ccc" }),
];
assert.equal(dedupeCompetitorAds(reuploads).length, 2, "3 re-uploads of one video + 1 image = 2 distinct creatives");

// A different PAGE running the identical asset path is a different creative (page is part of the key).
assert.equal(dedupeCompetitorAds([ad({ pageId: "P1", videoUrl: "https://cdn.fb/v/a.mp4" }), ad({ pageId: "P2", videoUrl: "https://cdn.fb/v/a.mp4" })]).length, 2, "same asset on two pages is not merged");

// Copy-only ads (no asset URL) dedupe by ad copy; identical copy collapses.
assert.equal(dedupeCompetitorAds([ad({ adArchiveId: "c1", media: "image", body: "Same body copy" }), ad({ adArchiveId: "c2", media: "image", body: "Same body copy" })]).length, 1, "identical copy with no asset dedupes");

// --- 2) The dedupe FEEDS the shares: inflated re-uploads must not skew the format mix. ---
// Competitors: 6 video rows but only 2 distinct videos, + 2 distinct images => deduped mix = 50/50.
const compAds: CompetitorAdLike[] = [
  ...Array.from({ length: 3 }, () => ad({ videoUrl: "https://cdn.fb/v/one.mp4?t=" + Math.random() })), // 1 distinct
  ...Array.from({ length: 3 }, () => ad({ videoUrl: "https://cdn.fb/v/two.mp4?t=" + Math.random() })), // 1 distinct
  ad({ media: "image", imageUrl: "https://cdn.fb/i/a.jpg" }),
  ad({ media: "image", imageUrl: "https://cdn.fb/i/b.jpg" }),
];
// Own mix: heavily carousel (a real over-concentration), almost no video.
const ownBuckets = [
  { name: "carousel", spendShare: 0.81, count: 40 },
  { name: "image", spendShare: 0.13, count: 8 },
  { name: "video", spendShare: 0.06, count: 3 },
];
const cmp = compareDiversityToCompetitors(ownBuckets, compAds)!;
assert.ok(cmp, "a real comparison is returned when both sides have data");
assert.equal(cmp.competitorAdsRaw, 8, "raw competitor rows counted");
assert.equal(cmp.competitorAdsDeduped, 4, "deduped to 4 distinct creatives (2 video + 2 image)");
assert.equal(cmp.duplicatesRemoved, 4, "4 re-upload duplicates removed");

const video = cmp.formats.find((f) => f.format === "video")!;
assert.equal(Math.round(video.competitorShare! * 100), 50, "video is 50% of DISTINCT competitor ads, not 75% of raw rows");
assert.equal(Math.round(video.ownShare! * 100), 6, "own video spend share preserved from buckets");
assert.ok(video.gap, "competitors 50% video vs you 6% is flagged as a GAP");
assert.ok(cmp.gaps.some((g) => /Competitors run 50% video, you run 6%/.test(g)), "gap string names the real numbers");

const carousel = cmp.formats.find((f) => f.format === "carousel")!;
assert.ok(carousel.overConcentration, "81% carousel spend is flagged as over-concentration");
assert.ok(cmp.overConcentration.some((o) => /You are 81% carousel/.test(o)), "over-concentration string names the real number");

// The deterministic suggestion favours the biggest gap (video) - no LLM, grounded in the numbers.
assert.ok(cmp.suggestion && /video/.test(cmp.suggestion), "suggestion points at the video gap");

// --- 3) NULL on zero denominator: no competitors => null comparison (never a fake 0). ---
assert.equal(compareDiversityToCompetitors(ownBuckets, []), null, "no competitor ads => null, not a fabricated 0% comparison");
assert.equal(compareDiversityToCompetitors(ownBuckets, [ad({ isMyBrand: true })]), null, "only my-brand ads present => no competitors => null");
assert.equal(compareDiversityToCompetitors([], compAds), null, "no own format data => null");

// A format the competitors simply do not run is a REAL 0 for them (denominator > 0), not null.
const noCarouselComp = compareDiversityToCompetitors(ownBuckets, [ad({ media: "image", imageUrl: "https://cdn.fb/i/z.jpg" })])!;
const compCar = noCarouselComp.formats.find((f) => f.format === "carousel")!;
assert.equal(compCar.competitorShare, 0, "a format competitors do not run is 0, not null (they have ads, just not this format)");
assert.notEqual(compCar.competitorShare, null, "real 0, never null, when the denominator exists");

// --- 4) No fabricated over-index: an even, matched mix flags nothing. ---
const even = compareDiversityToCompetitors(
  [{ name: "video", spendShare: 0.5, count: 5 }, { name: "image", spendShare: 0.5, count: 5 }],
  [ad({ media: "video", videoUrl: "https://cdn.fb/v/p.mp4" }), ad({ media: "image", imageUrl: "https://cdn.fb/i/q.jpg" })],
)!;
assert.equal(even.gaps.length, 0, "a matched 50/50 mix has no gap");
assert.equal(even.overConcentration.length, 0, "a balanced mix is not over-concentrated");
assert.equal(even.suggestion, null, "nothing to diversify => no suggestion invented");

console.log("PASS: diversity vs competitors (dedupe + null-on-zero + gap + over-concentration + suggestion)");
