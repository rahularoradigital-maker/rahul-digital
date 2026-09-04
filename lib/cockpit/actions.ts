// Phase 8 (audit): pure verdict->action mapping + queue ordering for the cockpit, extracted from analyze.ts.
// No I/O, no scoring - just how an engine decision becomes the leaderboard's action row and the do-now order.
import type { Verdict } from "../rules/verdict.ts";
import type { Decision } from "../scoring/decision.ts";
import type { MarginalRead } from "../scoring/marginal.ts";
import type { Priority, CockpitAction, CockpitAdInput, CockpitView } from "./types.ts";

// The single scale-action label, shared so both scale paths (actionFor winner + the objective-aware
// DECISION_LABEL) emit the exact same string - which lets reconcileScaleWithSaturation match it robustly.
export const SCALE_LABEL = "Scale the budget";

// Map the objective-aware decision to the leaderboard's verdict vocabulary + the action row.
export const DECISION_VERDICT: Record<Decision["action"], Verdict> = {
  scale: "winner",
  continue: "winner",
  refresh: "refresh",
  pause: "loser",
  hold: "do_not_kill_yet",
};
export const DECISION_LABEL: Record<Decision["action"], string> = {
  scale: SCALE_LABEL,
  continue: "Keep running",
  refresh: "Refresh the creative",
  pause: "Pause this ad",
  hold: "Hold - gather more data",
};

const PRIORITY_RANK: Record<Priority, number> = { DO_NOW: 0, DO_NEXT: 1, WATCH: 2 };

// Order the do-now queue: priority tier first (DO_NOW > DO_NEXT > WATCH), then MONEY AT STAKE within a
// tier (biggest rupee first), so the single most expensive fix sits at the very top - the queue reads
// as a decision, not a list. Pure + exported so it is testable.
export function orderByMoneyAtStake<T extends { priority: Priority; moneyAtStakeRs: number }>(items: T[]): T[] {
  return [...items].sort((x, y) => PRIORITY_RANK[x.priority] - PRIORITY_RANK[y.priority] || y.moneyAtStakeRs - x.moneyAtStakeRs);
}

/** Turn a verdict (+ any diagnosed cause) into the single next action for that ad. */
export function actionFor(v: Verdict, input: CockpitAdInput): CockpitAction {
  const d = input.diagnosis;
  const cause = d !== undefined && d.status === "ok" ? d.cause : undefined;
  switch (v) {
    case "loser":
      return { label: "Kill this ad", priority: "DO_NOW", why: "Creative is spent and every non-creative cause was ruled out." };
    case "refresh":
      return { label: "Refresh the creative", priority: "DO_NEXT", why: "Fatigue is high but the funnel still converts. New creative, same offer." };
    case "do_not_kill_yet":
      if (cause !== undefined && cause !== "creative_fatigue") {
        return { label: `Fix ${cause.replace(/_/g, " ")} first`, priority: "DO_NEXT", why: "The drop traces to a non-creative cause. Do not kill the ad." };
      }
      return { label: "Hold — gather more data", priority: "WATCH", why: "Not enough signal to act without risk." };
    case "winner":
      return input.roomToScale
        ? { label: SCALE_LABEL, priority: "DO_NEXT", why: "All winner gates met with room to scale." }
        : { label: "Keep running", priority: "WATCH", why: "A proven winner with no headroom to scale right now." };
  }
}

// Reconcile a per-ad SCALE call with the account's diminishing-returns read (marginal.ts). A per-ad "scale /
// push budget" is an AVERAGE-ROAS decision, but the scale decision is MARGINAL - so when the account is
// bending down (APPROACHING_SATURATION) or past the point where the next rupee pays (SATURATED), adding new
// budget spends into waste. We keep the ad's winner status but reframe the ACTION as reallocation: fund the
// winner by shifting budget off weak/saturated ads, not by adding spend. Pure; returns the view unchanged for
// UNDERFUNDED / HEALTHY / UNKNOWN (where scaling by adding budget is still the right call, or unproven).
type Saturation = MarginalRead["classification"];
const SATURATING: ReadonlySet<Saturation> = new Set<Saturation>(["APPROACHING_SATURATION", "SATURATED"]);

function reallocationAction(a: CockpitAction, saturated: boolean): CockpitAction {
  return {
    label: saturated ? "Scale by reallocation only" : "Scale by reallocation - hold total budget",
    priority: a.priority,
    why: saturated
      ? "Account is saturated: the next NEW rupee returns less than it costs. Grow this winner only by reallocating budget off weak/saturated ads, not by adding spend."
      : "Account returns are bending down (approaching saturation). Fund this winner by shifting budget off weak ads, not by adding new spend.",
  };
}

export function reconcileScaleWithSaturation(view: CockpitView, classification: Saturation): CockpitView {
  if (!SATURATING.has(classification)) return view;
  const saturated = classification === "SATURATED";
  return {
    ...view,
    leaderboard: view.leaderboard.map((a) => (a.action.label === SCALE_LABEL ? { ...a, action: reallocationAction(a.action, saturated) } : a)),
    doThis: view.doThis.map((d) => (d.label === SCALE_LABEL ? { ...d, ...reallocationAction(d, saturated) } : d)),
  };
}
