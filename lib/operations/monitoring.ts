// Monitoring & history, PURE half (Track A, Phase A6). No I/O, no server-only, RELATIVE imports so the runnable
// check loads it in plain node. Splits the queue into what still needs a human vs what was decided, names the
// outbound action AdScale took (Track A only ever HANDS OFF - it does not execute), and renders a deterministic
// one-line summary of a proposal for the history. No fabricated "delivered" state: a handed-off op is exactly
// that until the user applies it in Ads Manager.
import type { PendingStatus } from "./approval.ts";
import type { ValidationResult } from "./validate.ts";

export function isAwaiting(status: PendingStatus): boolean {
  return status === "ready_for_approval" || status === "blocked";
}
export function isDecided(status: PendingStatus): boolean {
  return status === "approved" || status === "handed_off" || status === "rejected";
}

// The honest outcome line for a decided op. Track A never says "executed" - approve = handed off for the human
// to apply; reject = no action taken.
export function outcomeLabel(status: PendingStatus): string {
  if (status === "approved" || status === "handed_off") return "Approved - handed off to Ads Manager to apply";
  if (status === "rejected") return "Rejected - no change made";
  return "";
}

// Deterministic one-line proposal summary from the operation kind + the A4 validation computed values. Never
// invents a number - it reads only what validation already computed.
export function proposalSummary(kind: string, validation: ValidationResult | null | undefined): string {
  const c = validation?.computed ?? {};
  if (kind === "propose_budget_change" && c.appliedPct != null) {
    return `${c.direction ?? "change"} budget by ${String(c.appliedPct)}%`;
  }
  if (kind === "propose_pause") return "pause";
  return kind;
}
