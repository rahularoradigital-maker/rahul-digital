// Runnable check for the competitor analytics engine (stages 4-6 + deterministic stage 8)
// and the ScrapeCreators URL/normalize helpers. No network: pure functions over fixtures.
// Run: node --experimental-strip-types scripts/check-competitors.ts
import assert from "node:assert/strict";
import { pageIdFromAdLibraryUrl } from "../lib/scrapecreators.ts";
import { analyzeBrand, buildReport, buildCreativeIntel, buildTrafficByBrand } from "../lib/competitors/analytics.ts";
import { mergeAttributes, anyFilled } from "../lib/agents/creative/orchestrator.ts";
import type { AnalyzedCreative, CreativeAttributes, NormalizedAd } from "../lib/competitors/types.ts";

// --- URL -> page id extraction (the only manual input in the pipeline). ---
assert.equal(pageIdFromAdLibraryUrl("https://www.facebook.com/ads/library/?view_all_page_id=367152833370567"), "367152833370567");
assert.equal(pageIdFromAdLibraryUrl("https://www.facebook.com/ads/library?id=1185617869915074"), "1185617869915074");
assert.equal(pageIdFromAdLibraryUrl("  367152833370567  "), "367152833370567");
assert.equal(pageIdFromAdLibraryUrl("https://example.com/not-an-ad-library"), null, "a non-Ad-Library URL yields null, not a guess");

function ad(over: Partial<NormalizedAd>): NormalizedAd {
  return {
    pageId: "1", adArchiveId: Math.random().toString(36).slice(2), brandLabel: "Brand", isMyBrand: false,
    isActive: true, displayFormat: "IMAGE", media: "image", ctaText: "Shop Now", ctaType: "SHOP_NOW",
    title: "T", body: "Buy our thing", linkUrl: "https://x.com", platforms: ["FACEBOOK"], startDate: 100, endDate: null,
    cardCount: 0, adUrl: "https://fb.com/ad", imageUrl: null, videoUrl: null, videoThumbUrl: null, ...over,
  };
}

// --- Per-brand analytics (stages 4-6). ---
const mine: NormalizedAd[] = [
  ad({ pageId: "me", brandLabel: "My Brand", isMyBrand: true, media: "image", ctaText: "Shop Now", isActive: true }),
  ad({ pageId: "me", brandLabel: "My Brand", isMyBrand: true, media: "image", ctaText: "Shop Now", isActive: false }),
];
const rival: NormalizedAd[] = [
  ad({ pageId: "rv", brandLabel: "Rival", media: "video", ctaText: "Learn More", isActive: true, platforms: ["INSTAGRAM"] }),
  ad({ pageId: "rv", brandLabel: "Rival", media: "carousel", cardCount: 3, ctaText: "Sign Up", isActive: true }),
];

const myAnalytics = analyzeBrand(mine);
assert.equal(myAnalytics.totalAds, 2);
assert.equal(myAnalytics.activeAds, 1);
assert.equal(myAnalytics.inactiveAds, 1);
assert.equal(myAnalytics.formatMix.image, 2);
assert.equal(myAnalytics.ctaMix[0].label, "Shop Now");
assert.equal(myAnalytics.ctaMix[0].count, 2);
assert.equal(myAnalytics.topCreatives[0].isActive, true, "active creatives lead the top list");

// --- Competitive report (stage 8 deterministic): my brand vs competitors + whitespace. ---
const report = buildReport([...mine, ...rival]);
assert.ok(report.myBrand && report.myBrand.label === "My Brand");
assert.equal(report.competitors.length, 1);
assert.equal(report.competitors[0].label, "Rival");
// My brand runs only image + Shop Now; the rival runs video, carousel, Learn More, Sign Up.
assert.deepEqual(report.gaps.formats.sort(), ["carousel", "video"], "formats the rival uses that my brand does not");
assert.deepEqual(report.gaps.ctas.sort(), ["Learn More", "Sign Up"], "CTAs the rival uses that my brand does not");

// --- No my-brand tagged: report still analyzes competitors, gaps empty (nothing to compare). ---
const noMine = buildReport(rival);
assert.equal(noMine.myBrand, null);
assert.deepEqual(noMine.gaps.formats, []);

// --- Ad traffic distribution: where each brand sends its ad clicks (landing-page host). ---
const trafficAds: NormalizedAd[] = [
  ad({ pageId: "me", brandLabel: "My Brand", isMyBrand: true, linkUrl: "https://mybrand.in/product/123" }),
  ad({ pageId: "me", brandLabel: "My Brand", isMyBrand: true, linkUrl: "https://www.amazon.in/dp/B0XYZ" }),
  ad({ pageId: "rv", brandLabel: "Rival", linkUrl: "https://www.flipkart.com/rival-shirt/p/abc" }),
  ad({ pageId: "rv", brandLabel: "Rival", linkUrl: "https://play.google.com/store/apps/details?id=com.rival" }),
  ad({ pageId: "rv", brandLabel: "Rival", linkUrl: null }),
];
const traffic = buildTrafficByBrand(trafficAds);
const myTraffic = traffic.find((t) => t.isMyBrand)!;
assert.equal(traffic[0].isMyBrand, true, "my brand leads the traffic table");
const myDest = (label: string) => myTraffic.destinations.find((d) => d.label === label);
assert.equal(myDest("Own site")?.count, 1, "a brand-site host buckets to Own site");
assert.equal(myDest("Amazon")?.count, 1, "an amazon.in host buckets to Amazon");
assert.equal(myDest("Own site")?.pct, 50);
const rivalTraffic = traffic.find((t) => !t.isMyBrand)!;
const rivalDest = (label: string) => rivalTraffic.destinations.find((d) => d.label === label);
assert.equal(rivalDest("Flipkart")?.count, 1, "a flipkart.com host buckets to Flipkart");
assert.equal(rivalDest("App store")?.count, 1, "a play.google.com host buckets to App store");
assert.equal(rivalDest("Other")?.count, 1, "a missing link buckets to Other, not a fake destination");
for (const t of traffic) {
  const sum = t.destinations.reduce((acc, d) => acc + d.pct, 0);
  assert.ok(Math.abs(sum - 100) <= 2, `percentages sum to ~100 for ${t.label} (got ${sum})`);
}
// The same data flows through buildReport onto the report.
assert.deepEqual(buildReport(trafficAds).trafficByBrand, traffic, "buildReport carries trafficByBrand");

// --- Stage 7 aggregation: funnel mix per brand + hook/offer/emotion patterns. ---
function attrs(over: Partial<CreativeAttributes>): CreativeAttributes {
  const base = Object.fromEntries(
    ["funnelStage", "hook", "hookType", "firstThreeSeconds", "messaging", "offer", "cta", "productVsHuman",
     "creatorTraits", "voiceAudio", "visualScene", "colorTypography", "branding", "painPoint", "benefit",
     "primaryEmotion", "socialProof", "storytelling", "editingPacing", "closing", "conversionIntent", "notes"]
      .map((k) => [k, null]),
  ) as CreativeAttributes;
  return { ...base, ...over };
}
function analyzed(pageId: string, isMyBrand: boolean, over: Partial<CreativeAttributes>): AnalyzedCreative {
  return { adArchiveId: Math.random().toString(36).slice(2), pageId, brandLabel: isMyBrand ? "My Brand" : "Rival", isMyBrand, attributes: attrs(over) };
}
const intel = buildCreativeIntel([
  analyzed("me", true, { funnelStage: "TOF", hookType: "Question", offer: "Free shipping", primaryEmotion: "Curiosity" }),
  analyzed("me", true, { funnelStage: "BOF", hookType: "Discount", offer: "20% off", primaryEmotion: "Urgency" }),
  analyzed("rv", false, { funnelStage: "BOF", hookType: "Discount", offer: "20% off", primaryEmotion: "Urgency" }),
  analyzed("rv", false, { funnelStage: null, hookType: null }),
]);
assert.equal(intel.analyzedCount, 4);
const mineFunnel = intel.funnelByBrand.find((f) => f.isMyBrand)!;
assert.equal(mineFunnel.tof, 1);
assert.equal(mineFunnel.bof, 1);
assert.equal(intel.funnelByBrand[0].isMyBrand, true, "my brand leads the funnel table");
const rivalFunnel = intel.funnelByBrand.find((f) => !f.isMyBrand)!;
assert.equal(rivalFunnel.bof, 1);
assert.equal(rivalFunnel.unknown, 1, "an unclassified creative counts as unknown, not a fake stage");
assert.equal(intel.hookTypes[0].label, "Discount", "most-used hook type first");
assert.equal(intel.hookTypes[0].count, 2);
assert.equal(intel.offers[0].label, "20% off");

// --- Stage 7 orchestration merge: small agents each fill their own slice, no clobbering. ---
const hookSlice: Partial<CreativeAttributes> = { hook: "Bold claim", hookType: "Bold claim" };
const offerSlice: Partial<CreativeAttributes> = { offer: "20% off", cta: "Shop Now" };
const emptySlice: Partial<CreativeAttributes> = { hook: "none", hookType: "" }; // a failed/blank agent
const funnelSlice: Partial<CreativeAttributes> = { funnelStage: "bof", notes: "hard offer + shop CTA" };
const merged = mergeAttributes([hookSlice, offerSlice, emptySlice, funnelSlice]);
assert.equal(merged.hook, "Bold claim", "first non-empty value wins");
assert.equal(merged.offer, "20% off", "each agent contributes its own slice");
assert.equal(merged.funnelStage, "BOF", "funnel stage is coerced to the TOF/MOF/BOF enum");
assert.equal(merged.branding, null, "an attribute no agent filled stays null, never fabricated");
assert.equal(anyFilled(merged), true);
assert.equal(anyFilled(mergeAttributes([{ hook: "none" }, {}])), false, "all-empty slices analyze to nothing (caller skips)");

console.log("PASS: competitor analytics + url/normalize checks");
