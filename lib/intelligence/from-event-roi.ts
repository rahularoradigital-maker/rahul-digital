// Adapter: the event ROI reallocation (lib/scoring/event-roi) -> the unified §110 Output Contract. Turns
// "these conversion events bleed vs your best" into a reasoning-backed decision (DATA -> ... -> LEARNING),
// WITHOUT editing the engine (protocol: new files). Deterministic + pure. Returns null when nothing bleeds.

import { eventBleedSummary, type EventRoi } from "../scoring/event-roi.ts";
import { decide, type OutputContract } from "./output-contract.ts";

const evt = (s: string) => s.replace(/_/g, " ").toLowerCase();

export function eventBleedToContract(rows: EventRoi[], opts: { entityId: string; accountName?: string }): OutputContract | null {
  const bleed = eventBleedSummary(rows);
  if (!bleed) return null;

  const revenueEvents = rows.filter((e) => e.material && e.hasRevenue && e.roiPct !== null);
  const best = revenueEvents.reduce<EventRoi | null>((b, e) => (!b || (e.roiPct as number) > (b.roiPct as number) ? e : b), null);
  const bleeders = revenueEvents.filter((e) => (e.roiPct as number) < 0);
  const names = bleeders.map((e) => evt(e.event)).join(", ");
  const bestName = best ? evt(best.event) : "your best event";
  const bestPart = best && (best.roiPct as number) > 0 ? ` while ${bestName} returns +${best.roiPct}%` : "";

  return decide({
    id: `event-bleed:${opts.entityId}`,
    kind: "event-reallocation",
    entity: { level: "account", id: opts.entityId, name: opts.accountName },
    data: { summary: `Rs ${bleed.bleedRs.toLocaleString("en-IN")} on conversion-intent events returning below break-even (${names})`, source: "meta-store" },
    tier: "CALCULATED",
    trustReason: "spend + purchase revenue summed per optimisation event from the store; ROI only where the event has real revenue",
    signal: `${bleeders.length} conversion event${bleeders.length === 1 ? "" : "s"} with negative ROI`,
    diagnosis: `Budget is optimising for events (${names}) that return far less revenue than they cost${bestPart}.`,
    economicImpactRs: bleed.bleedRs,
    secondOrder: "Shifting budget toward the best-returning event should lift blended ROI, but a large jump resets the ad set's learning phase for a few days.",
    thirdOrder: "If almost all spend then rides one event, the account is more fragile to that event fatiguing or its costs rising.",
    decision: { call: `Reallocate toward ${bestName}`, why: "the bleeding events lose money on their own conversion terms" },
    action: `Draft: step down the ${names} campaigns and move budget to ${bestName}-optimised ones - not all at once; watch the learning phase.`,
    whatCouldBeWrong: "These events may play a real top-funnel role that last-click purchase attribution under-credits (view-through / assist). Check the funnel before cutting - do not judge an awareness step purely on last-click ROI.",
    confidence: best && !best.thinSample ? "high" : "med",
    sampleNote: bleeders.some((e) => e.thinSample) ? "some bleeding events have thin purchase samples - directional" : undefined,
  });
}
