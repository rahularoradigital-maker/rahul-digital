import { getConnectionHealth } from "@/lib/connection/status";

// Reusable "Data as of X" line for data screens (funnel, changes, ...). The cockpit already shows its sync
// freshness, but the diagnostic screens showed numbers with no hint of how old they are - a §24 freshness
// gap. This async server component reads the account's last sync (cheap single indexed row via
// getConnectionHealth) and renders one honest muted line. Renders nothing if there's no sync yet (the page's
// own "hasn't synced" empty state covers that) or on any read failure - never blocks or fabricates.
export async function DataFreshness({ userId, accountExternalId }: { userId: string; accountExternalId: string | null }) {
  const health = await getConnectionHealth(userId, true, accountExternalId);
  if (!health.lastSyncedLabel) return null;
  const stale = health.status === "stale" || health.status === "error";
  return (
    <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
      Data as of {health.lastSyncedLabel}.{stale ? " Reconnect or re-sync for the latest." : ""}
    </p>
  );
}
