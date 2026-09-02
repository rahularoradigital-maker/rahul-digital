// Adapter: the marginal-scaling read (MarginalRead, from lib/scoring/marginal) -> the §110 Output Contract.
// New file, no engine edit. This is the §47 discipline in code: do NOT recommend scaling just because ROAS is
// high - decide on the diminishing-returns curve (spend elasticity). TRUST gate: an UNKNOWN classification
// (too few days / no spend variation to fit the curve) -> HOLD, never a guessed scaling call.

import type { MarginalRead } from "@/lib/scoring/marginal";
import { hold, decide, type OutputContract, type Confidence } from "./output-contract.ts";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
function tierOf(n: number): Confidence {
  return n >= 0.7 ? "high" : n >= 0.4 ? "med" : "low"; // MarginalRead.confidence is 0..1
}

type Live = Exclude<MarginalRead["classification"], "UNKNOWN">;
const DECISION: Record<Live, { call: string; why: string; action: string; second: string; third: string }> = {
  UNDERFUNDED: {
    call: "Increase budget", why: "the next rupee still returns MORE than the average - real headroom",
    action: "Draft a step-up in budget and re-measure the elasticity after a few days - reversible.",
    second: "A big jump can reset the learning phase and distort the very curve you are scaling on - ramp in steps.",
    third: "Genuine headroom captured early compounds; miss it while the ad is fresh and the window closes.",
  },
  HEALTHY: {
    call: "Scale in measured steps", why: "mild diminishing returns - still profitable to grow, but carefully",
    action: "Draft a modest budget increase and watch marginal ROAS; stop stepping when it crosses your floor.",
    second: "Each step returns a little less; scale past the point where the marginal rupee still pays and you erode blended efficiency.",
    third: "Over-scaling a healthy ad quietly turns it into a saturated one - and hides the need for new creative.",
  },
  APPROACHING_SATURATION: {
    call: "Hold budget; line up the next winner", why: "returns are bending down - more budget now buys noticeably less",
    action: "Draft new creative to test instead of adding budget here; hold this ad's spend steady.",
    second: "Pushing more into a bending curve spends real money for shrinking return.",
    third: "Leaning on a saturating ad delays the creative pipeline you will need when it fully saturates.",
  },
  SATURATED: {
    call: "Do not scale - reallocate", why: "the next rupee returns LESS than it costs here",
    action: "Draft a reallocation of any extra budget to a headroom ad or a fresh test - not into this one.",
    second: "Extra budget on a saturated ad is close to pure waste; the money works harder almost anywhere else.",
    third: "Repeatedly funding saturated winners starves the tests that become tomorrow's winners.",
  },
};

export function marginalToContract(read: MarginalRead, opts: { entityId: string; name?: string; spendRs: number }): OutputContract | null {
  const name = opts.name ?? opts.entityId;
  const e = read.spendElasticity;
  const data = { summary: `${name}: elasticity ${e != null ? e.toFixed(2) : "?"} · ${inr(opts.spendRs)} spend`, source: "meta-store" as const };
  const entity = { level: "ad" as const, id: opts.entityId, name };

  if (read.classification === "UNKNOWN") {
    return hold({
      id: `scale:${opts.entityId}`, kind: "scaling", entity, data, tier: "INFERENCE",
      reason: read.why[0] ?? "not enough day-wise history / spend variation to model diminishing returns",
      whatToDo: "Let it run with some daily spend variation before making a scaling call - the curve can't be fit yet.",
      confidence: "low",
    });
  }

  const spec = DECISION[read.classification];
  const mroas = read.marginalRoas != null ? ` Next-rupee ROAS ~${read.marginalRoas.toFixed(2)}.` : "";
  return decide({
    id: `scale:${opts.entityId}`, kind: "scaling", entity, data, tier: "INFERENCE",
    trustReason: `elasticity fit on the day-wise spend/revenue curve (confidence ${Math.round(read.confidence * 100)}%)`,
    signal: `${read.classification.replace(/_/g, " ").toLowerCase()} - spend elasticity ${e != null ? e.toFixed(2) : "?"}.${mroas}`,
    diagnosis: read.why[0] ?? spec.why,
    economicImpactRs: opts.spendRs,
    secondOrder: spec.second,
    thirdOrder: spec.third,
    decision: { call: spec.call, why: spec.why },
    action: spec.action,
    whatCouldBeWrong: "The elasticity curve lags: a recent budget change, a new audience, or seasonality can break the fit, so a fresh shift may not follow the modelled slope.",
    confidence: tierOf(read.confidence),
    sampleNote: read.currentRoas != null ? `current ROAS ${read.currentRoas.toFixed(2)}` : undefined,
  });
}
