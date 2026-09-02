// Pure helpers for account rollups (no I/O, no server-only) so scripts/check-rollups.ts can import them
// without pulling in the Supabase client. The DB read/write lives in ./account.ts.
import type { ReconReport } from "@/lib/reconcile/scopes";

export const ROLLUP_WINDOW_DAYS = 90; // the fixed app-wide comparison window (LOOKBACK_DAYS)
export const ROLLUP_FRESH_MS = 26 * 60 * 60 * 1000; // daily sync cadence + slack

// The whole-account headline extracted from a ReconReport (the "whole" scope, never a filtered one).
export function rollupHeadline(report: ReconReport): { spend: number; revenue: number; ads: number } {
  const whole = report.scopes.find((s) => s.key === "whole");
  return { spend: whole?.spend ?? 0, revenue: whole?.revenue ?? 0, ads: whole?.ads ?? 0 };
}

// Is a rollup computed at `computedAtIso` still fresh at `nowMs`? Unparseable timestamps are never fresh.
export function isRollupFresh(computedAtIso: string, nowMs: number, maxAgeMs: number = ROLLUP_FRESH_MS): boolean {
  const t = Date.parse(computedAtIso);
  return Number.isFinite(t) && nowMs - t <= maxAgeMs;
}
