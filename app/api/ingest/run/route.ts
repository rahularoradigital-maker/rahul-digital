import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { syncAdMetrics } from "@/lib/ingest/ad-metrics";

// Run the day-wise ingestion for the signed-in user's active account, on demand. Auth-gated (a user can
// only sync their own account). Complete coverage: captures EVERY spending ad day-wise into ad_metrics,
// no top-N cap. maxDuration is high because a full-account backfill can take minutes. This is the manual
// counterpart to the nightly cron sync - same function, so results are identical.
export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ error: "Connect a Meta ad account first." }, { status: 400 });

  const res = await syncAdMetrics(user.id, session.activeExternalId, session.token);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error ?? "Sync failed." }, { status: 502 });
  return NextResponse.json({ ok: true, adsSeen: res.adsSeen, rows: res.rows, since: res.since });
}
