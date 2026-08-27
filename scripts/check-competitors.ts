// Runnable check for the competitor analytics engine (stages 4-6 + deterministic stage 8)
// and the ScrapeCreators URL/normalize helpers. No network: pure functions over fixtures.
// Run: node --experimental-strip-types scripts/check-competitors.ts
import assert from "node:assert/strict";
import { pageIdFromAdLibraryUrl } from "../lib/scrapecreators.ts";
import { analyzeBrand, buildReport } from "../lib/competitors/analytics.ts";
import type { NormalizedAd } from "../lib/competitors/types.ts";

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
    cardCount: 0, adUrl: "https://fb.com/ad", ...over,
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

console.log("PASS: competitor analytics + url/normalize checks");
