// Proof for event-ROI trend (lib/scoring/event-roi): compares an event's ROI to the equal-length window
// before it. A trend appears ONLY where the event had real revenue in BOTH windows and the move clears the
// noise floor - never a fabricated arrow on thin/awareness data. Also proves priorWindow date math.
// Run: node --experimental-strip-types scripts/check-event-roi-trend.ts
import { computeEventRoi, eventRoiTrend, priorWindow } from "../lib/scoring/event-roi.ts";
let pass = 0;
function ok(c: boolean, m: string) { if (!c) throw new Error("FAIL: " + m); pass++; }

// priorWindow: the 30-day window just before a 30-day window, inclusive, no TZ drift.
const pw = priorWindow("2026-08-04", "2026-09-02");
ok(pw.priorUntil === "2026-08-03", "prior window ends the day before the current window");
ok(pw.priorSince === "2026-07-05", "prior window is the same length (30d), immediately before");
const one = priorWindow("2026-09-02", "2026-09-02"); // single-day window
ok(one.priorSince === "2026-09-01" && one.priorUntil === "2026-09-01", "1-day window -> 1-day prior");

const cur = computeEventRoi([
  { event: "PURCHASE", spendRs: 100000, revenueRs: 300000, purchases: 500 },   // ROI +200%
  { event: "CONTENT_VIEW", spendRs: 50000, revenueRs: 30000, purchases: 40 },  // ROI -40%
  { event: "LEAD", spendRs: 40000, revenueRs: 42000, purchases: 60 },          // ROI +5%
  { event: "REACH", spendRs: 20000, revenueRs: 0, purchases: 0 },              // no revenue -> null
]);
const prior = computeEventRoi([
  { event: "PURCHASE", spendRs: 100000, revenueRs: 400000, purchases: 500 },   // was ROI +300%  (now +200 -> worsening -100)
  { event: "CONTENT_VIEW", spendRs: 50000, revenueRs: 45000, purchases: 40 },  // was ROI -10%   (now -40  -> worsening -30)
  { event: "LEAD", spendRs: 40000, revenueRs: 41200, purchases: 60 },          // was ROI +3%    (now +5   -> delta 2 -> flat)
  { event: "REACH", spendRs: 20000, revenueRs: 5000, purchases: 3 },           // awareness; current null -> skipped
]);
const t = eventRoiTrend(cur, prior);
ok(t.get("PURCHASE")?.direction === "worsening" && t.get("PURCHASE")?.deltaPct === -100, "even a still-positive ROI shows worsening when it fell");
ok(t.get("CONTENT_VIEW")?.direction === "worsening" && t.get("CONTENT_VIEW")?.deltaPct === -30, "a deepening bleed reads worsening");
ok(t.get("LEAD")?.direction === "flat", "a sub-threshold move is flat, not a false signal");
ok(!t.has("REACH"), "no trend on an event lacking current revenue - never a guessed arrow");
ok(!eventRoiTrend(cur, []).size, "no prior window -> empty trend, not an invented one");
const imp = eventRoiTrend(
  computeEventRoi([{ event: "PURCHASE", spendRs: 100000, revenueRs: 250000, purchases: 500 }]),   // +150
  computeEventRoi([{ event: "PURCHASE", spendRs: 100000, revenueRs: 200000, purchases: 500 }]),   // +100
);
ok(imp.get("PURCHASE")?.direction === "improving" && imp.get("PURCHASE")?.deltaPct === 50, "a rising ROI reads improving with the right delta");

console.log(`check-event-roi-trend: ${pass} assertions passed.`);
