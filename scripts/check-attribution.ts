// One runnable check for the attribution-lag tail trim used by all directional reads. No frameworks.
// Run: node --experimental-strip-types scripts/check-attribution.ts
import assert from "node:assert/strict";
import { settledRows, ATTRIBUTION_TAIL_DAYS } from "../lib/scoring/attribution.ts";

const day = (d: string, v = 0) => ({ date: d, v });
const dates = (rows: { date: string }[]) => [...new Set(rows.map((r) => r.date))].sort();

// A 14-day window drops the most recent ATTRIBUTION_TAIL_DAYS days, keeps the rest.
const w14 = Array.from({ length: 14 }, (_, i) => day(`2026-08-${String(i + 1).padStart(2, "0")}`));
const s14 = settledRows(w14);
assert.equal(dates(s14).length, 14 - ATTRIBUTION_TAIL_DAYS, "14-day window keeps all but the settling tail");
assert.ok(!dates(s14).includes("2026-08-14"), "the partial last day is dropped");
assert.ok(!dates(s14).includes("2026-08-13"), "the second-to-last (still settling) day is dropped");
assert.ok(dates(s14).includes("2026-08-12"), "settled days are kept");

// Short windows are never gutted: <= 3 distinct days is returned untouched (a biased read beats none).
assert.deepEqual(settledRows([day("2026-08-01"), day("2026-08-02"), day("2026-08-03")]).length, 3, "3-day window not trimmed");
assert.deepEqual(settledRows([day("2026-08-01"), day("2026-08-02")]).length, 2, "2-day window not trimmed");

// Floor holds: a 5-day window keeps at least 3 (drops 2), never fewer.
assert.equal(dates(settledRows(Array.from({ length: 5 }, (_, i) => day(`2026-08-0${i + 1}`)))).length, 3, "5-day -> keep 3");

// Rows that SHARE a date are dropped together (matched by date, not by row).
const shared = [day("2026-08-01"), day("2026-08-02"), day("2026-08-03"), day("2026-08-04"), day("2026-08-05"), day("2026-08-05")];
const ss = settledRows(shared);
assert.ok(!ss.some((r) => r.date === "2026-08-05"), "both rows on the dropped date are removed");

// The point of the trim: a flat metric with a crashed (unattributed) last day should read ~flat once
// the tail is dropped, instead of steeply negative.
const flatThenCrash = [
  { date: "2026-08-01", roas: 3 }, { date: "2026-08-02", roas: 3 }, { date: "2026-08-03", roas: 3 },
  { date: "2026-08-04", roas: 3 }, { date: "2026-08-05", roas: 3 }, { date: "2026-08-06", roas: 0.2 },
];
const settled = settledRows(flatThenCrash).map((r) => r.roas);
assert.ok(settled.every((v) => v === 3), "the crashed unattributed tail is gone; the settled series is flat");

console.log("PASS: attribution tail trim (drops settling tail, floors short windows, groups by date)");
