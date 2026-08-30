import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWithTimeout } from "@/lib/http";
import type { TokenSet } from "@/lib/ad-source";
import { mapActivityRow, dedupeChanges, type RawActivity, type ChangeRow } from "./change-map.ts";

// Change-history ingestion (Phase 1 of Media-Buyer Change Intelligence). Pulls the account's Ad Activity log
// (who changed what, at campaign/ad-set/ad level) into ad_changes, INCREMENTALLY: it resumes from the last
// event_time cursor so the daily cron only fetches new changes. Meta's activity log is a rolling window with
// no guaranteed depth, so we must poll + persist from day one. Never throws - returns ok:false so the cron
// loop continues, mirroring syncAdMetrics.

const GRAPH = "https://graph.facebook.com/v21.0";
const FIELDS = "event_type,event_time,actor_id,actor_name,object_id,object_name,object_type,extra_data,translated_event_type";
const MAX_PAGES = 25;
const DEFAULT_BACKFILL_DAYS = 30;

export type ChangeSyncResult = { ok: boolean; seen: number; since: string; error?: string };

// Page the activities edge from `sinceISO` forward, following the cursor. Bearer header (never token in query).
async function fetchActivities(accountExternalId: string, token: TokenSet, sinceISO: string): Promise<RawActivity[]> {
  const out: RawActivity[] = [];
  let after: string | undefined;
  const sinceUnix = String(Math.floor(new Date(sinceISO).getTime() / 1000));
  for (let page = 0; page < MAX_PAGES; page++) {
    const u = new URL(`${GRAPH}/act_${accountExternalId}/activities`);
    u.searchParams.set("fields", FIELDS);
    u.searchParams.set("limit", "200");
    u.searchParams.set("since", sinceUnix);
    if (after) u.searchParams.set("after", after);
    const res = await fetchWithTimeout(u, { headers: { Authorization: `Bearer ${token.accessToken}` } }, 15_000);
    if (!res.ok) throw new Error(`activities ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const json = (await res.json()) as { data?: RawActivity[]; paging?: { cursors?: { after?: string }; next?: string } };
    out.push(...(json.data ?? []));
    after = json.paging?.cursors?.after;
    if (!after || !json.paging?.next || (json.data?.length ?? 0) === 0) break;
  }
  return out;
}

export async function syncChangeHistory(userId: string, accountExternalId: string, token: TokenSet, opts: { backfillDays?: number } = {}): Promise<ChangeSyncResult> {
  const admin = createAdminClient();
  const writeState = (fields: Record<string, unknown>) =>
    admin
      .from("change_sync_state")
      .upsert({ user_id: userId, account_external_id: accountExternalId, last_run_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...fields }, { onConflict: "user_id,account_external_id" })
      .then(undefined, () => {});

  // Resume from the cursor; first run backfills a bounded window (Meta won't give unlimited history anyway).
  const { data: state } = await admin.from("change_sync_state").select("last_event_time").eq("user_id", userId).eq("account_external_id", accountExternalId).maybeSingle();
  const since = (state?.last_event_time as string | null) ?? new Date(Date.now() - (opts.backfillDays ?? DEFAULT_BACKFILL_DAYS) * 86_400_000).toISOString();

  let raw: RawActivity[];
  try {
    raw = await fetchActivities(accountExternalId, token, since);
  } catch (e) {
    const error = e instanceof Error ? e.message : "activities fetch failed";
    await writeState({ last_ok: false, last_error: error.slice(0, 500) });
    return { ok: false, seen: 0, since, error };
  }

  const rows = dedupeChanges(raw.map(mapActivityRow).filter((r): r is ChangeRow => r !== null));
  let maxEventTime = (state?.last_event_time as string | null) ?? null;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500).map((r) => ({ user_id: userId, account_external_id: accountExternalId, ...r, updated_at: new Date().toISOString() }));
    const { error } = await admin.from("ad_changes").upsert(batch, { onConflict: "user_id,account_external_id,change_id" });
    if (error) {
      await writeState({ last_ok: false, last_error: `upsert: ${error.message}`.slice(0, 500), changes_seen: rows.length });
      return { ok: false, seen: rows.length, since, error: error.message };
    }
  }
  for (const r of rows) if (!maxEventTime || r.event_time > maxEventTime) maxEventTime = r.event_time;
  await writeState({ last_ok: true, last_error: null, changes_seen: rows.length, last_event_time: maxEventTime });
  return { ok: true, seen: rows.length, since };
}
