// Runnable self-check for the fatigue forecast engine. No framework, no fixtures: build a few
// fake FatigueRead objects inline and assert the forecast behaves the way a media buyer expects.
//
//   node --experimental-strip-types scripts/check-fatigue-forecast.ts
//
// Prints "PASS: fatigue forecast checks" on success, throws on the first broken expectation.

import type { FatigueRead } from "../lib/scoring/fatigue.ts";
import { forecastFatigue, frameFatigue } from "../lib/scoring/fatigue-forecast.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error("FAIL: " + msg);
}

function inRange01(p: number): boolean {
  return typeof p === "number" && Number.isFinite(p) && p >= 0 && p <= 1;
}

// 1. Worsening, high-index creative: heavy frequency + decay, short half-life. Should read as
//    likely-to-fatigue, and MORE likely at +14 than at +7.
const worsening: FatigueRead = {
  sufficiency: "ok",
  windowDays: 14,
  index: 70,
  state: "fatiguing",
  trajectory: "worsening",
  signals: { frequency: 78, ctrDecay: 62, cpmRise: 55 },
  daysToFatigue: 5,
  evidence: ["fake worsening read"],
};

// 2. Fresh, low-index creative: healthy, stable, no half-life. Should read as low probability.
const fresh: FatigueRead = {
  sufficiency: "ok",
  windowDays: 10,
  index: 12,
  state: "fresh",
  trajectory: "stable",
  signals: { frequency: 15, ctrDecay: 8, cpmRise: 5 },
  daysToFatigue: null,
  evidence: ["fake fresh read"],
};

// 3. Insufficient data: too few days to read a trend. Should be low confidence.
const insufficient: FatigueRead = {
  sufficiency: "insufficient_data",
  windowDays: 2,
  index: 0,
  state: "fresh",
  trajectory: "stable",
  signals: { frequency: 0, ctrDecay: 0, cpmRise: 0 },
  daysToFatigue: null,
  evidence: ["fake insufficient read"],
};

const fW = forecastFatigue(worsening);
const fF = forecastFatigue(fresh);
const fI = forecastFatigue(insufficient);

// Every probability must be a valid 0..1 number.
for (const f of [fW, fF, fI]) {
  assert(inRange01(f.day7.probability), "day7 probability out of 0..1");
  assert(inRange01(f.day14.probability), "day14 probability out of 0..1");
  assert(inRange01(f.confidence), "confidence out of 0..1");
  assert(f.label === "PREDICTED", "label must be PREDICTED");
}

// Worsening: rises over time and both horizons are high-ish.
assert(fW.day14.probability > fW.day7.probability, "worsening: +14d should exceed +7d");
assert(fW.day7.probability > 0.5, "worsening: +7d should be high-ish (>0.5)");
assert(fW.day14.probability > 0.5, "worsening: +14d should be high-ish (>0.5)");
assert(fW.day14.band === "high", "worsening: +14d band should be high");
assert(fW.drivers.length > 0 && fW.drivers.some((d) => d.includes("frequency")), "worsening: should name frequency saturation");

// Fresh: low probabilities at both horizons. LOW_BAND mirrors the module's low/medium cut.
const LOW_BAND = 0.33;
assert(fF.day7.probability < LOW_BAND, "fresh: +7d should be low");
assert(fF.day14.probability < LOW_BAND, "fresh: +14d should be low");
assert(fF.day7.band === "low" && fF.day14.band === "low", "fresh: both bands should be low");

// Insufficient: low confidence, and a lower confidence than a sufficient read.
assert(fI.confidence < 0.25, "insufficient: confidence should be low (<0.25)");
assert(fI.confidence < fW.confidence, "insufficient: confidence should be below a sufficient read");
assert(fI.day7.band === "low" && fI.day14.band === "low", "insufficient: both bands should be low");

// --- Framing (frameFatigue): named-ad + countdown + mechanism + cost impact, no fabrication. ---

// Worsening read has a real days-to-line (5) and frequency-dominant signals: dated countdown,
// exposure-saturation mechanism, sentence names both.
const frW = frameFatigue(worsening);
assert(frW.hasSignal, "worsening: should have signal");
assert(frW.dated && frW.countdown === "~5 days", "worsening: countdown should be the real ~5 days");
assert(frW.mechanism.includes("exposure"), "worsening: frequency-dominant mechanism should name exposure saturating");
assert(frW.headline.includes("~5 days") && frW.headline.includes("because"), "worsening: headline frames countdown + mechanism");

// A ctrDecay-dominant read (efficiency, not exposure) names the earning-per-impression mechanism.
const decayRead: FatigueRead = { ...worsening, signals: { frequency: 20, ctrDecay: 80, cpmRise: 10 }, daysToFatigue: 3 };
const frD = frameFatigue(decayRead);
assert(frD.countdown === "~3 days" && frD.mechanism.includes("per impression"), "decay-dominant: ~3 days + earning-less-per-impression mechanism");

// daysToFatigue === 0 reads as already past the line, not a fabricated number.
const atFloor: FatigueRead = { ...worsening, daysToFatigue: 0 };
const frFloor = frameFatigue(atFloor);
assert(!frFloor.dated && frFloor.countdown === "now" && frFloor.headline.includes("Already past"), "at-floor: reads as already past the line");

// Dated countdown but NO moving driver (ad-set end caps the half-life): must NOT claim a fatigue
// crossing - report it as the effective half-life instead. Guards an honesty edge.
const endCapped: FatigueRead = { ...fresh, daysToFatigue: 3, signals: { frequency: 5, ctrDecay: 3, cpmRise: 2 } };
const frEnd = frameFatigue(endCapped);
assert(frEnd.dated && frEnd.countdown === "~3 days", "end-capped: real dated countdown");
assert(!frEnd.headline.includes("fatigue line") && frEnd.headline.includes("Effective half-life"), "end-capped: no fabricated fatigue crossing");

// Fresh read has no dated crossing: honest "no dated crossing yet", never an invented countdown.
const frF = frameFatigue(fresh);
assert(frF.hasSignal && !frF.dated && frF.countdown === "no dated crossing yet", "fresh: no fabricated countdown");

// Insufficient data: no signal, no fake number, says so plainly.
const frI = frameFatigue(insufficient);
assert(!frI.hasSignal && frI.countdown === "not enough signal yet", "insufficient: not enough signal, no fake number");
assert(frI.headline.includes("Not enough signal"), "insufficient: headline is honest");

console.log("PASS: fatigue forecast checks");
