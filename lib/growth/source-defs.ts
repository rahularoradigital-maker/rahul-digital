// Pure source-registry definitions + health logic (no I/O, no server-only) so it is unit-testable. The
// server-only writer/reader lib/growth/sources.ts imports these.

export type SourceDef = { source_id: string; platform: string; method: string; status: string; note?: string };
export type SourceHealth = "healthy" | "degraded" | "down" | "unknown";

// The registry. Adding a source = one entry here + its adapter in discover.ts (no scattered platform logic).
export const SOURCE_DEFS: SourceDef[] = [
  { source_id: "hackernews", platform: "Hacker News", method: "api", status: "active" },
  { source_id: "stackexchange", platform: "StackExchange", method: "api", status: "active" },
  { source_id: "googlenews", platform: "Google News", method: "rss", status: "active" },
  { source_id: "reddit", platform: "Reddit", method: "public-json", status: "needs_setup", note: "needs a free Reddit app (REDDIT_CLIENT_ID/SECRET); server-unauthenticated access is 403" },
];

// Decide a source's health from its last run. ok=false -> down; ok with 0 items -> degraded (reachable but
// empty); ok with items -> healthy.
export function healthFor(ok: boolean, count: number): SourceHealth {
  if (!ok) return "down";
  return count > 0 ? "healthy" : "degraded";
}
