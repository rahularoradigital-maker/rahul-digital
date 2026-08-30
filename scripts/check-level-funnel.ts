// One runnable check for the per-level funnel rollups. No frameworks.
// Run: node --experimental-strip-types scripts/check-level-funnel.ts
import assert from "node:assert/strict";
import { levelFunnels, type LevelInputAd } from "../lib/cockpit/level-funnel.ts";
import type { ExtendedMetricsRow } from "../lib/metrics/funnel-metrics.ts";

function row(over: Partial<ExtendedMetricsRow> = {}): ExtendedMetricsRow {
  return {
    date: "2026-08-01", spend: 0, impressions: 0, clicks: 0, outboundClicks: 0, video3sViews: 0,
    videoThruplays: 0, landingPageViews: 0, addToCarts: 0, initiateCheckouts: 0, purchases: 0, ...over,
  };
}
function ad(over: Partial<LevelInputAd> = {}): LevelInputAd {
  return { adSetId: "as1", adsetName: "Set 1", campaignId: "c1", campaignName: "Camp 1", rows: [], ...over };
}

// Empty in -> empty groups.
assert.deepEqual(levelFunnels([]), { adset: [], campaign: [] });

// Two ads in the same ad set + campaign roll UP into ONE group; spend sums; CTR is over the combined rows.
const r = levelFunnels([
  ad({ rows: [row({ spend: 100, impressions: 1000, clicks: 10 })] }),
  ad({ rows: [row({ spend: 300, impressions: 1000, clicks: 50 })] }),
]);
assert.equal(r.adset.length, 1, "same ad set -> one group");
assert.equal(r.adset[0].spendRs, 400, "spend rolled up");
assert.equal(r.adset[0].funnel.ctr, 3, "ctr over combined rows = 60/2000 *100");
assert.equal(r.campaign.length, 1, "same campaign -> one group");
assert.equal(r.campaign[0].spendRs, 400);

// Different campaigns are separate groups, sorted by spend desc.
const s = levelFunnels([
  ad({ campaignId: "small", campaignName: "Small", rows: [row({ spend: 50, impressions: 100, clicks: 1 })] }),
  ad({ campaignId: "big", campaignName: "Big", rows: [row({ spend: 900, impressions: 100, clicks: 5 })] }),
]);
assert.equal(s.campaign.length, 2);
assert.equal(s.campaign[0].id, "big", "sorted by spend desc");
assert.equal(s.campaign[1].id, "small");

// An ad missing the grouping id is skipped at that level, never guessed. Null ratio on zero denom.
const z = levelFunnels([
  ad({ adSetId: undefined, campaignId: "c9", rows: [row({ spend: 10, impressions: 0, clicks: 0 })] }),
]);
assert.equal(z.adset.length, 0, "no ad-set id -> skipped from ad-set level");
assert.equal(z.campaign.length, 1);
assert.equal(z.campaign[0].funnel.ctr, null, "0 impressions -> ctr null, never fake 0");

// limit caps the number of groups returned.
const many = Array.from({ length: 12 }, (_, i) => ad({ campaignId: `c${i}`, campaignName: `C${i}`, rows: [row({ spend: i + 1 })] }));
assert.equal(levelFunnels(many, 8).campaign.length, 8, "limit respected");

// Strike graph + liveness: each group carries a day-wise spend series (the trend), and `delivering` is true
// only when it spent within 7 days of the window's last data day. asOf below = 2026-08-29 (the latest date).
const t = levelFunnels([
  ad({ campaignId: "live", campaignName: "Live", rows: [row({ date: "2026-08-20", spend: 100 }), row({ date: "2026-08-29", spend: 100 })] }),
  ad({ campaignId: "stopped", campaignName: "Stopped", rows: [row({ date: "2026-08-01", spend: 100 }), row({ date: "2026-08-05", spend: 100 })] }),
]);
const liveG = t.campaign.find((g) => g.id === "live")!;
const stoppedG = t.campaign.find((g) => g.id === "stopped")!;
assert.equal(liveG.delivering, true, "group spending near the window end is delivering");
assert.equal(stoppedG.delivering, false, "group whose last spend was 3+ weeks ago is NOT delivering");
assert.deepEqual(liveG.daily.map((d) => d.date), ["2026-08-20", "2026-08-29"], "daily strike-graph series is sorted by date");
assert.equal(liveG.daily.reduce((s, d) => s + d.spend, 0), 200, "daily spend series sums to the group's total spend");

// Native level metrics (reach/frequency/budget) merge by entity id; a group with no native entry stays
// undefined so the UI shows "n/a" rather than a fabricated number.
const withNative = levelFunnels([ad({ campaignId: "c1", campaignName: "C1", rows: [row({ spend: 100 })] })], 8, {
  adset: new Map(),
  campaign: new Map([["c1", { reach: 5000, frequency: 2.1, budgetRs: 1000, budgetType: "daily" }]]),
});
assert.equal(withNative.campaign[0].native?.reach, 5000, "native reach merged by campaign id");
assert.equal(withNative.campaign[0].native?.frequency, 2.1, "native frequency merged");
assert.equal(withNative.campaign[0].native?.budgetRs, 1000, "native budget merged");
assert.equal(withNative.campaign[0].native?.budgetType, "daily", "native budget type merged");
const noNative = levelFunnels([ad({ campaignId: "c2", campaignName: "C2", rows: [row({ spend: 50 })] })], 8);
assert.equal(noNative.campaign[0].native, undefined, "no native map -> native undefined (UI shows n/a, never fabricated)");

console.log("PASS: per-level funnel rollups (group + rollup + sort + skip-missing-id + null-on-zero + limit + strike-graph + liveness + native-merge)");
