// Pure helpers for account rollups (no I/O, no server-only) so scripts/check-rollups.ts can import them
// without pulling in the Supabase client. The DB read/write lives in ./account.ts.
import type { ReconReport } from "@/lib/reconcile/scopes";
// Relative + .ts so the check runner (node --experimental-strip-types) can resolve this VALUE import; the `@/`
// alias only resolves under tsc/Next, and a check imports this module directly.
import { reconcile, reconSummary, type Reconciliation, type ReconSummary } from "../intelligence/reconcile.ts";

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

// Self-consistency check (10x #5, feeds #1): the STORED rollup vs a FRESH recompute of the same headline.
// A match means the precompute still reflects the store; a conflict means the store moved on since the rollup
// was written (it is stale - refresh it) or a compute bug. Uses f3's pure reconcile()/reconSummary() engine,
// so the verdict + confidence penalty are the same the drift alarm uses everywhere. Not a cross-SOURCE check
// (both come from the store) - that (store vs live Meta) is the deeper #1 slice.
export function buildRollupRecon(
  stored: { spend: number; revenue: number },
  fresh: { spend: number; revenue: number },
): { recs: Reconciliation[]; summary: ReconSummary } {
  return reconHeadlines(stored, fresh, "rollup", "store-now");
}

// Reconcile the two headline numbers (spend + revenue) between ANY two sources. Used for rollup-vs-store
// (staleness) AND store-vs-Meta (the true cross-source #1 accuracy check).
export function reconHeadlines(
  a: { spend: number; revenue: number },
  b: { spend: number; revenue: number },
  sourceA: string,
  sourceB: string,
): { recs: Reconciliation[]; summary: ReconSummary } {
  const recs = [
    reconcile("spend", a.spend, b.spend, sourceA, sourceB),
    reconcile("revenue", a.revenue, b.revenue, sourceA, sourceB),
  ];
  return { recs, summary: reconSummary(recs) };
}
