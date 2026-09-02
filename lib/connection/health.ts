// Connection health (PURE). Turns the raw ad_sync_state row into an honest, user-facing status so a person
// can always see whether their data is fresh, stale, or broken - instead of only finding out via a cryptic
// cockpit error. ad_sync_state already captures last_ok / last_error / last_run_at / last_rows, but NONE of
// it was ever shown to the user. This is the brain that decides what to say; the settings page reads the row
// and renders it. No I/O here (testable in isolation, check-connection-health.ts).
//
// HONESTY (charter freshness + explicit-uncertainty + fail-honestly): never claim "healthy" for a stale or
// errored sync; surface the real last_error text; "connected but never synced" is its own honest state, not
// dressed up as healthy.

export type ConnectionState = {
  connected: boolean;
  lastRunAt: string | null; // ISO, when the sync job last ran
  lastSyncedDate: string | null; // the data date it reached
  lastOk: boolean | null; // did the last run succeed
  lastError: string | null; // captured failure text, if any
  lastRows: number | null; // rows written on the last run
};

export type ConnectionStatus = "disconnected" | "never_synced" | "error" | "stale" | "healthy";

export type ConnectionHealth = {
  status: ConnectionStatus;
  tone: "good" | "warn" | "bad"; // for the UI dot/pill, theme-token driven
  lastSyncedLabel: string | null; // "3 hours ago" / "2 days ago"
  ageHours: number | null;
  rows: number | null;
  error: string | null; // honest last_error, surfaced as-is (trimmed)
  needsReconnect: boolean; // error or disconnected -> offer Reconnect, not just Switch
  headline: string; // one plain-English line for the card
};

// Nightly cron syncs daily, so a run older than 48h means at least one sync was missed -> not "fresh".
export const STALE_HOURS = 48;

function ageHoursOf(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (now - t) / 3_600_000);
}

export function freshnessLabel(ageHours: number | null): string | null {
  if (ageHours == null) return null;
  if (ageHours < 1) return "under an hour ago";
  if (ageHours < 24) {
    const h = Math.round(ageHours);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.round(ageHours / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function summarizeConnection(s: ConnectionState, now: number = Date.now()): ConnectionHealth {
  const ageHours = ageHoursOf(s.lastRunAt, now);
  const lastSyncedLabel = freshnessLabel(ageHours);
  const error = s.lastError ? s.lastError.trim().slice(0, 300) : null;

  if (!s.connected) {
    return { status: "disconnected", tone: "bad", lastSyncedLabel: null, ageHours: null, rows: null, error: null, needsReconnect: true, headline: "No Meta account connected." };
  }
  if (s.lastOk === false || error) {
    return { status: "error", tone: "bad", lastSyncedLabel, ageHours, rows: s.lastRows ?? null, error, needsReconnect: true, headline: "The last sync failed. Reconnect to restore fresh data." };
  }
  if (!s.lastRunAt) {
    return { status: "never_synced", tone: "warn", lastSyncedLabel: null, ageHours: null, rows: null, error: null, needsReconnect: false, headline: "Connected - your first sync is on its way." };
  }
  if (ageHours != null && ageHours > STALE_HOURS) {
    return { status: "stale", tone: "warn", lastSyncedLabel, ageHours, rows: s.lastRows ?? null, error: null, needsReconnect: false, headline: `Data may be out of date - last synced ${lastSyncedLabel}.` };
  }
  return { status: "healthy", tone: "good", lastSyncedLabel, ageHours, rows: s.lastRows ?? null, error: null, needsReconnect: false, headline: `Up to date - last synced ${lastSyncedLabel}.` };
}
