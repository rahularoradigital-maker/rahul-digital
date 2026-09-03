import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { syncAdMetrics } from "@/lib/ingest/ad-metrics";
import { syncChangeHistory } from "@/lib/ingest/change-history";
import { refreshAccountRollup } from "@/lib/rollups/account";
import { refreshCreativeRollup } from "@/lib/rollups/creative";

// Run the day-wise ingestion for the signed-in user's active account, on demand. Auth-gated (a user can
// only sync their own account). Complete coverage: captures EVERY spending ad day-wise into ad_metrics,
// no top-N cap. A full-account backfill can take minutes, so the CALLER must keep the request open (the
// function stays alive as long as the request is active, up to maxDuration). The outcome is also recorded
// in ad_sync_state (last_ok / last_error / ads_seen) so a caller that gives up early can still see it land.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const _denied = await guardProductApi();
  if (_denied) return _denied;

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ error: "Connect a Meta ad account first." }, { status: 400 });

  // Optional ?days=N (1..90) to sync a shorter window - lets a quick backfill finish fast; the cron uses
  // the full 90-day default. Bounded so it can never ask for more than the comparison window.
  const daysParamRaw = Number(request.nextUrl.searchParams.get("days"));
  const backfillDays = Number.isFinite(daysParamRaw) && daysParamRaw > 0 ? Math.min(90, Math.floor(daysParamRaw)) : 90;
  // ONE resumable, deadline-bounded slice. For an account too big to finish in one request the caller
  // re-POSTs until `complete` is true (each call advances the stalest ads); a small account finishes in one.
  const res = await syncAdMetrics(user.id, session.activeExternalId, session.token, { backfillDays });
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error ?? "Sync failed." }, { status: 502 });
  // Change-history rides the same on-demand sync (best-effort, incremental) so the Change-Impact feature and
  // the media-buyer ranking populate whenever an account is synced - not ONLY via the nightly cron. It writes
  // its own change_sync_state.last_error, so a failure stays observable there even though we don't fail the
  // metrics response over it. This is the resilient path when the cron is not the one doing the syncing.
  const changes = await syncChangeHistory(user.id, session.activeExternalId, session.token, { backfillDays }).catch(() => null);
  // 10x #5: when the account is fully synced, refresh its rollup off no extra request (this response already
  // paid for the sync). Best-effort - a rollup failure never affects the sync outcome.
  if (res.complete) {
    await refreshAccountRollup(user.id, session.activeExternalId).catch(() => {});
    await refreshCreativeRollup(user.id, session.activeExternalId).catch(() => {});
  }
  return NextResponse.json({ ok: true, adsSeen: res.adsSeen, rows: res.rows, since: res.since, processed: res.processed, remaining: res.remaining, complete: res.complete, changesSeen: changes?.seen ?? null, changesOk: changes?.ok ?? false });
}
