// Adapter: one ad's funnel diagnosis (AdDiagnosis, from lib/funnel/diagnosis) -> the §110 Output Contract.
// New file, no engine edit. The funnel engine already computes its own honest TRUST gate (`hold`: too little
// spend / too few events / no fair baseline); when it holds, we HOLD with that exact reason - never inventing
// a leak. Otherwise the named weakest step (vs the account's own best same-objective ad) becomes the decision.

import type { AdDiagnosis } from "@/lib/funnel/diagnosis";
import { hold, decide, type OutputContract, type Confidence } from "./output-contract.ts";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function funnelToContract(d: AdDiagnosis): OutputContract | null {
  const name = d.name ?? d.adId;
  const stage = (d.stage as unknown as { label?: string; stage?: string; tag?: string });
  const stageLabel = stage.label ?? stage.stage ?? stage.tag ?? "funnel";
  const data = { summary: `${name}: ${stageLabel} stage · ${inr(d.spend)} spend`, source: "meta-store" as const };
  const entity = { level: "ad" as const, id: d.adId, name };

  // The engine's own honest refusal -> HOLD with its reason (never guess a leak).
  if (d.hold || !d.leak) {
    return hold({
      id: `funnel:${d.adId}`, kind: "funnel", entity, data, tier: "CALCULATED",
      reason: d.hold ?? "no leak can be honestly named",
      whatToDo: d.hold ?? "No trustworthy weakest step - treat as a direction to check, not a finding.",
      confidence: "low",
    });
  }

  const leak = d.leak;
  const gapPct = Math.round(leak.gap * 100);
  const ownBest = leak.ownBest != null ? ` (your best same-objective ad hits ${(leak.ownBest * 100).toFixed(1)}%)` : "";
  const conf: Confidence = gapPct >= 40 ? "high" : gapPct >= 20 ? "med" : "low";
  return decide({
    id: `funnel:${d.adId}`, kind: "funnel", entity, data, tier: "CALCULATED",
    trustReason: `weakest step set against a volume-qualified same-objective baseline`,
    signal: `${leak.label} is ${gapPct}% below your own best${ownBest}`,
    diagnosis: `The biggest leak for this ad is "${leak.label}" - it converts ${gapPct}% worse than the account's best same-objective ad, so the money is lost at that step, not upstream.`,
    economicImpactRs: d.spend,
    secondOrder: "Fixing the weakest step lifts the whole chain below it; leaving it means every upstream rupee keeps leaking there.",
    thirdOrder: "If the leak is a landing-page or checkout issue, scaling spend before fixing it just buys more of the same loss - efficiency falls as budget rises.",
    decision: { call: `Address the ${leak.label}`, why: `it is this ad's single biggest, most trustworthy leak vs your own best` },
    action: `Draft a fix for the ${leak.label} step (creative, landing page, or offer as the step implies) - reversible; measure before/after.`,
    whatCouldBeWrong: "If this ad's own denominator at that step is thin, or attribution is mis-timed, the gap may be noise rather than a real leak.",
    confidence: conf,
    sampleNote: leak.value != null ? `this ad ${(leak.value * 100).toFixed(1)}% at "${leak.label}"` : undefined,
  });
}
