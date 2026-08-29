// Defense-in-depth against cache/schema drift (ISSUE 26): a cached CONNECTED cockpit blob written by
// older code may lack fields the current render reads unconditionally (scopeTotals/dataQuality/marginal
// /funnel/metrics + nested view arrays). Rendering it would crash (the 2026-08-28 500). CACHE_SCHEMA
// versioning is the primary guard; this validates the actual shape on read so a forgotten version bump
// degrades to a fresh pull instead of a 500. It takes `unknown` (no import from meta-sync) so it is
// independently testable - see scripts/check-renderable.ts. Non-connected states are never cached, so
// they pass through; anything that is not an object at all is rejected (a corrupt blob -> fresh pull).
export function isRenderableShape(v: unknown): boolean {
  if (v == null || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (r.status !== "connected") return true;
  const view = r.view as Record<string, unknown> | undefined;
  return (
    view != null && r.scopeTotals != null && r.dataQuality != null && r.marginal != null && r.funnel != null && r.metrics != null &&
    Array.isArray(view.wasteContributors) && Array.isArray(view.atRiskContributors) && Array.isArray(view.leaderboard) && Array.isArray(view.doThis)
  );
}
