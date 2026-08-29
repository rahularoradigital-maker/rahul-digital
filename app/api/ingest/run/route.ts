import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { syncAdMetrics } from "@/lib/ingest/ad-metrics";

// Run the day-wise ingestion for the signed-in user's active account, on demand. Auth-gated (a user can
// only sync their own account). Complete coverage: captures EVERY spending ad day-wise into ad_metrics,
// no top-N cap. A full-account backfill can take minutes, so the sync runs in the BACKGROUND (after the
// response) - the request returns immediately and the sync completes even if the browser navigates away
// or the connection drops. Progress/outcome is recorded in ad_sync_state (last_ok / last_error / ads_seen).
export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ error: "Connect a Meta ad account first." }, { status: 400 });

  const { id: userId } = user;
  const { activeExternalId, token } = session;
  after(async () => {
    try {
      await syncAdMetrics(userId, activeExternalId, token);
    } catch (e) {
      console.error("[ingest/run] background sync failed", e);
    }
  });
  return NextResponse.json({ ok: true, started: true });
}
