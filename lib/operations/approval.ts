// Approval state machine (Track A, Phase A5). PURE, no I/O, no server-only, RELATIVE imports so the runnable
// check loads it in plain node. Defines the ONLY legal transitions for a pending operation, so the store can
// never skip a state (e.g. approve something that was blocked, or re-decide a terminal op). Track A ends at
// "approved" + an Ads-Manager hand-off; "handed_off" is kept for when the user opens that link. Nothing here
// executes - it only governs the human gate.
import type { ValidationResult } from "./validate.ts";

export type PendingStatus = "ready_for_approval" | "approved" | "rejected" | "blocked" | "handed_off";

// from -> the states it may move to. Terminal states have an empty list. No transition is implicit.
const ALLOWED: Record<PendingStatus, PendingStatus[]> = {
  ready_for_approval: ["approved", "rejected"], // the human decides
  approved: ["handed_off"], // Track A: the user opened the Ads-Manager link
  blocked: ["rejected"], // a validation-blocked op cannot be approved, only dismissed
  rejected: [], // terminal
  handed_off: [], // terminal
};

export function canTransition(from: PendingStatus, to: PendingStatus): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

// The status a freshly submitted operation gets from its A4 validation. A read (not_applicable) is NOT a
// pending operation - it never enters the queue. Returns null for those.
export function initialStatus(validation: ValidationResult): PendingStatus | null {
  if (validation.status === "validated") return "ready_for_approval";
  if (validation.status === "blocked") return "blocked";
  return null;
}

// The audit verb for a transition, so every state change leaves an immutable trail (A5 rule: no silent moves).
export function auditVerb(to: PendingStatus): string {
  return `operation.${to}`;
}
