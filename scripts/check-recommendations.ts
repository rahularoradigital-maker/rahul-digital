// One runnable check for the deterministic "next creatives to test" engine. No frameworks.
// Run: node --experimental-strip-types scripts/check-recommendations.ts
import assert from "node:assert/strict";
import { buildRecommendations } from "../lib/competitors/analytics.ts";
import type { BrandAnalytics, CompetitorReport, MediaCategory } from "../lib/competitors/types.ts";

const EMPTY_MIX: Record<MediaCategory, number> = { video: 0, image: 0, carousel: 0, other: 0 };

function brand(over: Partial<BrandAnalytics>): BrandAnalytics {
  return {
    label: "Brand",
    pageId: "1",
    isMyBrand: false,
    totalAds: 0,
    activeAds: 0,
    inactiveAds: 0,
    formatMix: { ...EMPTY_MIX },
    ctaMix: [],
    platformMix: [],
    topHooks: [],
    topCreatives: [],
    newLast7Days: 0,
    ...over,
  };
}

const report: CompetitorReport = {
  myBrand: brand({ label: "Me", isMyBrand: true, formatMix: { ...EMPTY_MIX, video: 5 }, topHooks: [{ label: "Big sale", count: 3 }] }),
  competitors: [
    brand({
      label: "Comp",
      formatMix: { ...EMPTY_MIX, video: 2, image: 3, carousel: 4 },
      topHooks: [{ label: "Did you know", count: 6 }, { label: "Big sale", count: 2 }],
    }),
  ],
  gaps: { formats: ["image", "carousel"], ctas: ["Learn more"] },
  trafficByBrand: [],
};

const recs = buildRecommendations(report);

// Format gaps -> one rec each, naming the count and the test.
const formatRecs = recs.filter((r) => r.kind === "format");
assert.equal(formatRecs.length, 2, "two format gaps -> two format recs");
assert.ok(formatRecs.every((r) => /1 competitor run/.test(r.reason) && /Test a/.test(r.reason)), "format reason names the count + the test");
assert.ok(formatRecs.some((r) => r.value === "image") && formatRecs.some((r) => r.value === "carousel"));

// CTA gap -> one rec.
const ctaRecs = recs.filter((r) => r.kind === "cta");
assert.equal(ctaRecs.length, 1);
assert.equal(ctaRecs[0].value, "Learn more");

// Hook opportunity -> competitor hook the brand does NOT use ("Did you know"); "Big sale" excluded
// because my brand already uses it.
const hookRecs = recs.filter((r) => r.kind === "hook");
assert.equal(hookRecs.length, 1, "only the un-shared competitor hook is recommended");
assert.equal(hookRecs[0].value, "Did you know");
assert.ok(!hookRecs.some((r) => r.value === "Big sale"), "a hook the brand already uses is not recommended");

// No my-brand -> no recommendations (a gap is defined relative to your brand).
assert.deepEqual(buildRecommendations({ ...report, myBrand: null }), []);

console.log("PASS: next-creatives-to-test recommendations (format/cta/hook gaps, real counts)");
