// Runnable check for the day-wise fatigue engine (lib/scoring/fatigue.ts).
// node --experimental-strip-types scripts/check-fatigue-daywise.ts
import assert from "node:assert/strict";
import { readFatigue } from "../lib/scoring/fatigue.ts";
import type { MetricsRow } from "../lib/ad-source.ts";

// Build `days` daily rows where clicks, frequency and spend move linearly from start->end.
function series(days: number, opts: { impr: number; clicks0: number; clicks1: number; freq0: number; freq1: number; spend0: number; spend1: number }): MetricsRow[] {
  const rows: MetricsRow[] = [];
  for (let i = 0; i < days; i++) {
    const t = days === 1 ? 0 : i / (days - 1);
    const day = String(i + 1).padStart(2, "0");
    rows.push({
      adExternalId: "x",
      date: `2026-08-${day}`,
      spend: opts.spend0 + (opts.spend1 - opts.spend0) * t,
      impressions: opts.impr,
      clicks: Math.round(opts.clicks0 + (opts.clicks1 - opts.clicks0) * t),
      purchases: 0,
      revenue: 0,
      frequency: opts.freq0 + (opts.freq1 - opts.freq0) * t,
    });
  }
  return rows;
}

// A clearly fatiguing ad: CTR 2% -> 1%, frequency 2 -> 6, CPM rising (spend 100 -> 200).
const fatiguing = readFatigue(series(14, { impr: 10000, clicks0: 200, clicks1: 100, freq0: 2, freq1: 6, spend0: 100, spend1: 200 }));
// A healthy ad: CTR steady ~2%, low flat frequency, flat CPM.
const fresh = readFatigue(series(14, { impr: 10000, clicks0: 200, clicks1: 205, freq0: 1.2, freq1: 1.3, spend0: 100, spend1: 100 }));

assert.equal(fatiguing.sufficiency, "ok");
assert.ok(fatiguing.index > fresh.index, "the fatiguing ad has a higher fatigue index");
assert.ok(fatiguing.state === "fatiguing" || fatiguing.state === "fatigued", `fatiguing ad state, got ${fatiguing.state}`);
assert.ok(fresh.state === "fresh" || fresh.state === "watch", `fresh ad state, got ${fresh.state}`);
assert.equal(fatiguing.trajectory, "worsening", "declining CTR + rising CPM -> worsening");
assert.ok(fatiguing.signals.ctrDecay > 0, "CTR decay signal fires on a declining CTR");
assert.ok(fatiguing.signals.cpmRise > 0, "CPM rise signal fires on a rising CPM");
assert.ok(typeof fatiguing.daysToFatigue === "number" && fatiguing.daysToFatigue >= 0, "a declining CTR yields a days-to-fatigue estimate");
assert.equal(fresh.daysToFatigue, null, "a non-declining CTR has no days-to-fatigue");

// Every read carries real day-wise evidence (nothing assumed).
assert.ok(fatiguing.evidence.length >= 3 && fatiguing.evidence[0].includes("CTR"), "evidence spells out the day-wise CTR move");

// Too few days is an honest insufficient_data, not a fabricated score.
const thin = readFatigue(series(2, { impr: 10000, clicks0: 200, clicks1: 100, freq0: 2, freq1: 4, spend0: 100, spend1: 150 }));
assert.equal(thin.sufficiency, "insufficient_data");
assert.equal(thin.daysToFatigue, null);

console.log("PASS: day-wise fatigue engine checks");
