// Runnable check for the connection-health engine (lib/connection/health.ts). Plain asserts.
// Run: npm run check:connection-health

import assert from "node:assert/strict";
import { summarizeConnection, freshnessLabel, STALE_HOURS, type ConnectionState } from "../lib/connection/health.ts";

const NOW = Date.parse("2026-09-03T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const base: ConnectionState = { connected: true, lastRunAt: hoursAgo(2), lastSyncedDate: "2026-09-03", lastOk: true, lastError: null, lastRows: 60 };

// disconnected wins over everything
{
  const h = summarizeConnection({ ...base, connected: false }, NOW);
  assert.equal(h.status, "disconnected");
  assert.equal(h.needsReconnect, true);
  assert.equal(h.tone, "bad");
}
// error: last_error present OR last_ok false -> error + needsReconnect, but still surfaces the real text
{
  const h = summarizeConnection({ ...base, lastError: "Error validating access token: session expired" }, NOW);
  assert.equal(h.status, "error");
  assert.equal(h.needsReconnect, true);
  assert.ok(h.error?.includes("session expired"));
  const h2 = summarizeConnection({ ...base, lastOk: false, lastError: null }, NOW);
  assert.equal(h2.status, "error");
}
// never synced: connected but no run yet
{
  const h = summarizeConnection({ ...base, lastRunAt: null }, NOW);
  assert.equal(h.status, "never_synced");
  assert.equal(h.needsReconnect, false);
  assert.equal(h.lastSyncedLabel, null);
}
// stale: older than STALE_HOURS
{
  const h = summarizeConnection({ ...base, lastRunAt: hoursAgo(STALE_HOURS + 5) }, NOW);
  assert.equal(h.status, "stale");
  assert.equal(h.tone, "warn");
  assert.equal(h.needsReconnect, false);
}
// healthy: recent + ok
{
  const h = summarizeConnection(base, NOW);
  assert.equal(h.status, "healthy");
  assert.equal(h.tone, "good");
  assert.equal(h.rows, 60);
  assert.ok(h.lastSyncedLabel?.includes("hour"));
}
// boundary: exactly at STALE_HOURS is still healthy (strictly greater = stale)
{
  const h = summarizeConnection({ ...base, lastRunAt: hoursAgo(STALE_HOURS) }, NOW);
  assert.equal(h.status, "healthy");
}
// freshnessLabel wording
assert.equal(freshnessLabel(null), null);
assert.equal(freshnessLabel(0.5), "under an hour ago");
assert.equal(freshnessLabel(1), "1 hour ago");
assert.equal(freshnessLabel(5), "5 hours ago");
assert.equal(freshnessLabel(24), "1 day ago");
assert.equal(freshnessLabel(72), "3 days ago");

console.log("check-connection-health: OK");
