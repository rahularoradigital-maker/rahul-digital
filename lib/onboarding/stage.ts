// First-run stage: the single honest source of "where is this user in getting to their first insight?".
// 10x lever #8 (time-to-first-insight). PURE: derives the stage from real signals so the status endpoint,
// the checklist, and any first-run UI all agree on the same truth. No I/O here.
//
// Why a stage and not just booleans: the friction that kills activation isn't the two setup clicks - it's
// the SILENT gap after them, where the account is connected + brand confirmed but the store hasn't synced
// yet, so the cockpit shows "Still syncing" with no sense of progress and the user thinks it's broken.
// Naming that gap ("syncing") as a real stage is what lets the UI say "Building your first insight..."
// instead of showing a dead screen.

export type FirstRunSignals = {
  metaConnected: boolean;
  brandConfirmed: boolean;
  hasData: boolean; // the store has at least one ad for the active account (first sync landed)
};

export type FirstRunStage = "connect" | "brand" | "syncing" | "ready";

export function firstRunStage(s: FirstRunSignals): FirstRunStage {
  if (!s.metaConnected) return "connect";
  if (!s.brandConfirmed) return "brand";
  if (!s.hasData) return "syncing";
  return "ready";
}

export function isFirstRunComplete(s: FirstRunSignals): boolean {
  return firstRunStage(s) === "ready";
}

// Progress for the UI: how many of the 3 milestones are behind us. "ready" is 3/3; "syncing" is 2/3 (both
// setup steps done, waiting on data). Deterministic and testable.
export function firstRunProgress(s: FirstRunSignals): { done: number; total: number } {
  const done = (s.metaConnected ? 1 : 0) + (s.brandConfirmed ? 1 : 0) + (s.hasData ? 1 : 0);
  return { done, total: 3 };
}
