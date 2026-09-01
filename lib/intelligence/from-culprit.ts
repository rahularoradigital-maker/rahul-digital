// Adapter: the real money-bleed / culprit diagnosis (`lib/scoring/culprit.ts`) -> the unified Output Contract
// (§110). This is the FIRST proof that the contract's reasoning chain fits a live engine's output, WITHOUT
// editing the engine (protocol: new files, no hot-file edits). Deterministic + pure. The rule the app is
// allowed to break here is naming a paused/ended entity - but ONLY as the diagnosed CAUSE of a past drop,
// never as a live thing to go act on (Rahul's global liveness rule); the action is framed accordingly.

import type { CulpritDiagnosis } from "@/lib/scoring/culprit";
import { hold, decide, type OutputContract } from "./output-contract.ts";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

// Returns null when there is nothing to surface (no material drop) - the caller only shows a card when there
// is a real finding. Returns a HOLD when a drop is real but no single cause is material enough to decide on.
export function culpritToContract(d: CulpritDiagnosis, opts: { entityId: string; entityLabel?: "campaign" | "ad set" }): OutputContract | null {
  const label = opts.entityLabel ?? "campaign";
  if (!d.dropped) return null; // no >=20% drop -> no bleed finding to report

  const metricWord = d.metric === "revenue" ? "Revenue" : "Spend";
  const impact = Math.max(0, d.priorRs - d.recentRs); // the money that actually disappeared vs the prior window
  const pct = Math.round(d.dropPct * 100);
  const data = { summary: `${metricWord} fell ${pct}% (${inr(d.priorRs)} → ${inr(d.recentRs)})`, source: "meta-store" as const };

  const top = d.culprits[0];
  if (!top) {
    // A real drop, but no single entity is a material share of the dropped metric -> we cannot honestly pin a
    // cause, so we HOLD rather than guess one (charter §5, rule #3: refuse to decide, say what to look at).
    return hold({
      id: `bleed:${opts.entityId}`,
      kind: "money-bleed",
      data,
      tier: "CALCULATED",
      reason: `a ${pct}% ${d.metric} drop with no single material cause`,
      whatToDo: "Review spend allocation across the account - the fall is spread, not one stopped entity.",
      confidence: "low",
    });
  }

  const share = Math.round(top.shareOfPrior * 100);
  const stopped = top.stoppedOn ? ` after ${top.stoppedOn}` : "";
  return decide({
    id: `bleed:${opts.entityId}`,
    kind: "money-bleed",
    entity: { level: label === "ad set" ? "adset" : "campaign", id: top.id, name: top.name },
    data,
    tier: "CALCULATED",
    trustReason: `${d.metric} drop of ${pct}% (>=20% is a real drop, not noise)`,
    signal: `${metricWord} down ${pct}% in the recent window`,
    diagnosis: `The ${label} "${top.name}" (${share}% of prior ${d.metric}) stopped delivering${stopped} - the most likely cause. It is paused/ended, so there is nothing to fix ON it.`,
    economicImpactRs: impact,
    secondOrder: "Relaunching or reallocating this budget shifts pressure onto the still-live entities, which may already be near their own capacity.",
    thirdOrder: "If the live pool cannot absorb the budget efficiently, the account's blended efficiency drops even after the reallocation.",
    decision: { call: "Relaunch or reallocate", why: `the drop traces to a stopped ${label}, not a problem in the live set` },
    action: `Draft: relaunch "${top.name}" if that result still matters, or shift its prior budget to a live winner - do NOT try to "fix" the paused entity.`,
    whatCouldBeWrong: "If the drop is really seasonality or a tracking/attribution gap - not this stopped entity - relaunching or reallocating will not recover the money.",
    confidence: d.culprits.length === 1 ? "high" : "med",
    sampleNote: `${d.culprits.length} material contributor${d.culprits.length === 1 ? "" : "s"} on the dropped metric`,
  });
}
