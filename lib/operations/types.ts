// The unified OPERATION object (Track A, Phase A1). One typed request that flows through the whole
// "intent -> validated -> approved -> ready" spine, replacing the one-off-per-feature shapes. This file is
// PURE TYPES only (no I/O, no server-only) so both the server interpreter and the runnable check import it.
//
// Design rule ("the less AI, the better"): the AI interpreter only CLASSIFIES the intent and copies the
// user's own words into `slots` as HINTS. It never computes or decides a final budget number or threshold -
// deterministic engines do that in a later phase (A4). Nothing here executes anything.

// The kinds of operation a user can express. Read-only kinds (diagnose, answer) proceed freely; the
// action kinds (propose_*, brief_*, launch_*) will later require deterministic validation + human approval.
export type OperationKind =
  | "propose_budget_change" // "raise ad_42 budget by 20%" - a PROPOSAL, never auto-applied
  | "propose_pause" // "pause the dying ad set"
  | "brief_new_campaign" // "launch a prospecting campaign for the soundbar"
  | "launch_creative" // "make + ship an ad for product X"
  | "diagnose" // read-only: run a tool and report (funnel / health / change / verdict)
  | "answer"; // plain grounded Q&A (routes to the existing Ask path)

export type OperationStatus =
  | "needs_clarification" // the request is missing what the kind needs; ask ONE question back
  | "draft" // interpreted and well-formed; not yet validated
  | "validated" // A4: deterministic parameter validation passed
  | "ready_for_approval" // A5: queued for human review
  | "approved" // A5: a human approved it
  | "rejected" // A5: a human rejected it
  | "handed_off" // A6: delivered as a draft / Ads-Manager deep link (Track A end state)
  | "executed"; // B1: pushed to the platform (Track B only, not built yet)

export type OperationSource = "ask" | "form" | "plan";

// Extracted HINTS only. Every field is what the user literally said, never a value the AI decided.
export type OperationSlots = {
  scope?: string; // "account", or an ad / ad set / campaign the user named
  target?: string; // the object the user is acting on (free text)
  direction?: "increase" | "decrease" | "pause" | "resume" | null;
  magnitudeHint?: string; // the RAW phrase, e.g. "20%" or "double" - a hint only, never used as the final number
  objective?: string; // e.g. "prospecting", "retargeting", "sales"
  note?: string; // any other free-text detail
};

export type Operation = {
  kind: OperationKind;
  status: OperationStatus;
  source: OperationSource;
  intentText: string; // the original request (sanitized), kept for the audit trail
  slots: OperationSlots;
  toolHint?: string; // which purpose-built tool this likely routes to (A3 consumes)
  clarify?: string; // when status is needs_clarification: the ONE question to ask back
  evidence: string[]; // grounding notes; never fabricated
};
