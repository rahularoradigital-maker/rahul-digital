// Adapter: one ad's fatigue read (CockpitAd, from lib/cockpit/analyze) -> the §110 Output Contract. New file,
// no engine edits. Deterministic. The TRUST gate is the app's own materiality rule: a rate on too few
// conversions is noise, so below the floor we HOLD ("not enough signal to act without risk") exactly like the
// ranked plan already shows - never a decision on thin data (charter §19/§92, rule #3). A stopped ad returns
// null (liveness rule: no action on paused/ended).

import type { CockpitAd } from "@/lib/cockpit/analyze";
import { objectiveFamily } from "../rules/objective-metrics.ts";
import { hold, decide, type OutputContract, type Confidence } from "./output-contract.ts";

const CONV_FLOOR = 50; // a rate needs a denominator; below this we can't act without risk (the app's own judge floor)
const stakeOf = (ad: CockpitAd) => (ad.wastedRs > 0 ? ad.wastedRs : ad.spendRs);
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
function tierOf(n: number): Confidence {
  return n >= 0.7 ? "high" : n >= 0.4 ? "med" : "low"; // CockpitAd.confidence is 0..1
}

export function fatigueToContract(ad: CockpitAd): OutputContract | null {
  if (ad.delivering === false || ad.active === false) return null; // liveness: no action on a stopped ad
  const state = (ad.fatigueRead as { state?: string } | undefined)?.state ?? ad.verdict;
  const data = { summary: `${ad.name}: ${ad.conversions} conv · ${inr(ad.spendRs)} spend`, source: "meta-store" as const };
  const entity = { level: "ad" as const, id: ad.id, name: ad.name };

  // TRUST gate (conversion / sales-family objectives): too few conversions -> HOLD, don't judge.
  const isConversionObj = objectiveFamily(ad.objective) === "sales";
  if (isConversionObj && ad.conversions < CONV_FLOOR) {
    return hold({
      id: `fatigue:${ad.id}`, kind: "fatigue", entity, data, tier: "CALCULATED",
      reason: `${ad.conversions} conversions, need >=${CONV_FLOOR}`,
      whatToDo: "Not enough signal to act without risk - let it reach a >=50-conversion sample first.",
      confidence: "low",
    });
  }

  const call = ad.action?.label ?? "Review";
  const why = ad.why?.[0] ?? `Fatigue state: ${state}`;
  const half = ad.halfLifeDays != null ? ` Half-life ~${ad.halfLifeDays}d.` : "";
  return decide({
    id: `fatigue:${ad.id}`, kind: "fatigue", entity, data, tier: "CALCULATED",
    trustReason: isConversionObj ? `${ad.conversions} conversions - enough to judge` : "sufficient delivery to read the trend",
    signal: `Fatigue: ${state}.${half}`,
    diagnosis: why,
    economicImpactRs: stakeOf(ad),
    secondOrder: "Refreshing or pausing this ad pushes its budget onto the rest of the set, raising delivery pressure on those creatives.",
    thirdOrder: "If the replacement pool is thin, the account's acquisition capacity narrows as more creatives fatigue at once.",
    decision: { call, why },
    action: `Draft the "${call}" in Studio - the change is reversible.`,
    whatCouldBeWrong: "If a budget jump reset the learning phase or the audience saturated, this is a delivery effect, not creative fatigue - check the change log before acting.",
    confidence: tierOf(ad.confidence),
    sampleNote: `${ad.conversions} conv`,
  });
}
