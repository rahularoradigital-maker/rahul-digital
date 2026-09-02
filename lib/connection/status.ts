import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeConnection, type ConnectionHealth } from "./health.ts";

// Server read: load the active account's most recent ad_sync_state row and summarize it into honest health.
// Tenancy: scoped by user_id AND account_external_id (never another tenant's row). Best-effort - any read
// failure degrades to a "connected, no sync info" summary rather than throwing (settings must always render).
export async function getConnectionHealth(
  userId: string,
  connected: boolean,
  accountExternalId: string | null,
): Promise<ConnectionHealth> {
  if (!connected || !accountExternalId) {
    return summarizeConnection({ connected, lastRunAt: null, lastSyncedDate: null, lastOk: null, lastError: null, lastRows: null });
  }
  type SyncRow = { last_ok: boolean | null; last_error: string | null; last_synced_date: string | null; last_run_at: string | null; last_rows: number | null };
  let row: SyncRow | null = null;
  try {
    const { data } = await createAdminClient()
      .from("ad_sync_state")
      .select("last_ok,last_error,last_synced_date,last_run_at,last_rows")
      .eq("user_id", userId)
      .eq("account_external_id", accountExternalId)
      .order("last_run_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = (data as SyncRow | null) ?? null;
  } catch {
    row = null; // degrade gracefully; connected stays true, just no freshness detail
  }
  return summarizeConnection({
    connected: true,
    lastRunAt: row?.last_run_at ?? null,
    lastSyncedDate: row?.last_synced_date ?? null,
    lastOk: row?.last_ok ?? null,
    lastError: row?.last_error ?? null,
    lastRows: row?.last_rows ?? null,
  });
}
