// Runnable check for the change-impact engine (lib/scoring/change-impact.ts). No I/O.
// node --experimental-strip-types scripts/check-change-impact.ts
import assert from "node:assert/strict";
import { measureChangeImpact, isolatedWindow, measureWithCascade, type CascadeLevel, type ImpactRow } from "../lib/scoring/change-impact.ts";

const DAY = 86_400_000;
const day = (s: string) => new Date(`${s}T00:00:00Z`).getTime();

// Build N days of identical rows starting at a date.
function days(n: number, row: Omit<ImpactRow, "date">, startDay = 1): ImpactRow[] {
  return Array.from({ length: n }, (_, i) => ({ date: `2026-08-${String(startDay + i).padStart(2, "0")}`, ...row }));
}

// Conversion objective: ROAS doubles after the change (both windows have >=15 conversions) -> improved.
const impr = measureChangeImpact({
  objective: "conversion",
  beforeRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 200 }), // ROAS 2.0, 21 conv
  afterRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 400 }, 10), // ROAS 4.0
});
assert.equal(impr.verdict, "improved", `expected improved, got ${JSON.stringify(impr)}`);
assert.equal(impr.metric, "ROAS");
assert.ok(impr.deltaPct !== null && impr.deltaPct >= 90, "roughly +100%");

// ROAS halves -> worsened.
const worse = measureChangeImpact({
  objective: "conversion",
  beforeRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 400 }),
  afterRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 200 }, 10),
});
assert.equal(worse.verdict, "worsened", `expected worsened, got ${JSON.stringify(worse)}`);
assert.ok((worse.deltaPct ?? 0) < 0, "negative delta");

// Small move -> flat.
const flat = measureChangeImpact({
  objective: "conversion",
  beforeRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 200 }),
  afterRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 208 }, 10), // +4%
});
assert.equal(flat.verdict, "flat", `expected flat, got ${JSON.stringify(flat)}`);

// Too few conversions -> insufficient (never a fake verdict).
const insuf = measureChangeImpact({
  objective: "conversion",
  beforeRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 1, revenue: 200 }), // 7 conv < 15
  afterRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 400 }, 10),
});
assert.equal(insuf.verdict, "insufficient", `expected insufficient, got ${JSON.stringify(insuf)}`);

// Traffic objective: CPC drops (spend halves, clicks constant) -> improved (lower CPC is better).
const cpc = measureChangeImpact({
  objective: "traffic",
  beforeRows: days(7, { spend: 400, impressions: 5000, clicks: 200, conversions: 0, revenue: 0 }), // CPC 2.0
  afterRows: days(7, { spend: 200, impressions: 5000, clicks: 200, conversions: 0, revenue: 0 }, 10), // CPC 1.0
});
assert.equal(cpc.verdict, "improved", `CPC drop should be improved, got ${JSON.stringify(cpc)}`);
assert.equal(cpc.metric, "CPC");

// Settled-tail trim: a 9-day after-window is judged on 7 settled days (last 2 trimmed).
const settled = measureChangeImpact({
  objective: "conversion",
  beforeRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 200 }),
  afterRows: days(9, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 400 }, 10),
});
assert.ok(settled.reason.includes("7d settled after"), `after-window should be trimmed to 7 settled days, got: ${settled.reason}`);

// --- isolatedWindow: a change's window must not cross an adjacent change on the same object ---
const c0 = day("2026-08-10");
// No neighbours -> full +/-7d window.
const full = isolatedWindow(c0, [], 7, 7);
assert.equal(full.beforeStart, c0 - 7 * DAY, "no prior change -> full 7d before");
assert.equal(full.afterEnd, c0 + 7 * DAY, "no next change -> full 7d after");

// A later change 3 days out clips the after-window to end the day BEFORE it (isolates this change).
const clippedAfter = isolatedWindow(c0, [day("2026-08-13")], 7, 7);
assert.equal(clippedAfter.afterEnd, day("2026-08-13") - DAY, "after-window ends the day before the next change");
assert.equal(clippedAfter.beforeStart, c0 - 7 * DAY, "before-window unaffected by a later change");

// A prior change 2 days back clips the before-window to start the day AFTER it.
const clippedBefore = isolatedWindow(c0, [day("2026-08-08")], 7, 7);
assert.equal(clippedBefore.beforeStart, day("2026-08-08") + DAY, "before-window starts the day after the prior change");

// A neighbour the very next day collapses the after-window (afterEnd <= changeDay) -> caller gets no after
// rows -> the engine returns insufficient rather than a confounded verdict.
const collapsed = isolatedWindow(c0, [day("2026-08-11")], 7, 7);
assert.ok(collapsed.afterEnd <= c0, "adjacent next-day change collapses the after-window");
const confounded = measureChangeImpact({
  objective: "conversion",
  beforeRows: days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 3, revenue: 200 }),
  afterRows: [], // collapsed window -> no after rows
});
assert.equal(confounded.verdict, "insufficient", "collapsed after-window -> insufficient, not confounded");

// --- coverage cascade: measure at the finest grain + shortest window that clears the volume floor ---
const cDay = day("2026-08-20");
// Ad grain: 7 conversions/window (< 15) -> insufficient at ad level. Ad-set grain: 30 conversions/window,
// ROAS doubles -> the cascade must fall back to ad-set and return "improved", labeled grain "adset".
const adThin = (rev: number, start: number) => days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 1, revenue: rev }, start);
const adsetFat = (rev: number, start: number) => days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 5, revenue: rev }, start);
const cascade = measureWithCascade(
  [
    { grain: "ad", objectId: "a1", objective: "conversion", rows: [...adThin(200, 13), ...adThin(400, 21)], changeDayMs: cDay, otherChangeDaysMs: [] },
    { grain: "adset", objectId: "s1", objective: "conversion", rows: [...adsetFat(200, 13), ...adsetFat(400, 21)], changeDayMs: cDay, otherChangeDaysMs: [] },
  ],
  [7, 10, 14],
);
assert.equal(cascade.verdict, "improved", `cascade should fall back to ad-set and read improved, got ${JSON.stringify(cascade)}`);
assert.equal(cascade.grain, "adset", `cascade must label the grain it actually measured, got ${cascade.grain}`);

// Finest-first: when the ad level itself clears the floor, the cascade must NOT climb to the parent.
const adFat = (rev: number, start: number) => days(7, { spend: 100, impressions: 2000, clicks: 60, conversions: 5, revenue: rev }, start);
const staysFine = measureWithCascade(
  [
    { grain: "ad", objectId: "a1", objective: "conversion", rows: [...adFat(200, 13), ...adFat(400, 21)], changeDayMs: cDay, otherChangeDaysMs: [] },
    { grain: "adset", objectId: "s1", objective: "conversion", rows: [...adFat(200, 13), ...adFat(9999, 21)], changeDayMs: cDay, otherChangeDaysMs: [] },
  ],
  [7, 10, 14],
);
assert.equal(staysFine.grain, "ad", `cascade must prefer the finest grain that clears, got ${staysFine.grain}`);

// All levels too thin -> insufficient, never a fabricated verdict (coverage never overrides honesty).
const allThin = measureWithCascade(
  [{ grain: "ad", objectId: "a1", objective: "conversion", rows: [...adThin(200, 13), ...adThin(400, 21)], changeDayMs: cDay, otherChangeDaysMs: [] }],
  [7, 10, 14],
);
assert.equal(allThin.verdict, "insufficient", `too-thin at every level must stay insufficient, got ${allThin.verdict}`);

console.log("PASS: change-impact engine (verdicts, objective metric, settled-tail trim, neighbour-isolated windows, coverage cascade)");
