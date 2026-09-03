import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { loadAccountRollup } from "@/lib/rollups/account";
import { reconHeadlines, summaryStatus, cleanStreak, ROLLUP_WINDOW_DAYS } from "@/lib/rollups/pure";
import { recordVerification, loadVerificationHistory } from "@/lib/rollups/verification";
import { fetchScopeInsights } from "@/lib/meta-source";
import { captureError } from "@/lib/observability";

// 10x #1 self-proving accuracy (the moat): prove our stored number against an INDEPENDENT source. This diffs
// the precomputed rollup (from our store) vs a FRESH live pull from Meta for the same window, and returns f3's
// reconcile verdict (match / minor_drift / conflict, with confidence penalty + a trustworthy flag). A conflict
// means our headline disagrees with Meta - never silently trust it. On-demand only (one aggregate Meta call),
// so it is off every hot path. Auth + product gated.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ ok: false, connected: false });

  const rollup = await loadAccountRollup(user.id, session.activeExternalId);
  if (!rollup) return NextResponse.json({ ok: false, connected: true, reason: "no_rollup", note: "No rollup yet - sync or open the reconcile page first." });

  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - ROLLUP_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  let live: { spend: number; revenue: number };
  try {
    const insights = await fetchScopeInsights(session.activeExternalId, since, session.token, undefined, until);
    live = { spend: insights.spend, revenue: insights.revenue };
  } catch (e) {
    captureError(e, { route: "account/verify" });
    // Fail honest: we could not fetch the independent source, so we do not claim a verdict.
    return NextResponse.json({ ok: false, connected: true, reason: "meta_unreachable", note: "Could not reach Meta to verify right now." }, { status: 502 });
  }

  const { recs, summary } = reconHeadlines({ spend: rollup.spend, revenue: rollup.revenue }, live, "store", "meta");
  const status = summaryStatus(summary);

  // Log this verification (append-only, best-effort) so accuracy is a trend, then read the streak back.
  await recordVerification(user.id, session.activeExternalId, {
    windowDays: ROLLUP_WINDOW_DAYS,
    spendStore: rollup.spend,
    spendMeta: live.spend,
    revenueStore: rollup.revenue,
    revenueMeta: live.revenue,
    worstDriftPct: summary.worstDriftPct,
    status,
    trustworthy: summary.trustworthy,
  });
  const history = await loadVerificationHistory(user.id, session.activeExternalId, 10);

  return NextResponse.json({
    ok: true,
    connected: true,
    account: session.activeAccountName ?? session.activeExternalId,
    window: { since, until },
    store: { spend: rollup.spend, revenue: rollup.revenue, computedAt: rollup.computedAt },
    meta: live,
    status, // match | minor_drift | conflict
    trustworthy: summary.trustworthy, // false => a headline CONFLICTS with Meta: do not trust blindly
    verdict: summary,
    notes: recs.map((r) => r.note),
    cleanStreak: cleanStreak(history), // consecutive trustworthy verifications, newest-first
    history: history.slice(0, 5).map((h) => ({ at: h.createdAt, status: h.status, trustworthy: h.trustworthy, worstDriftPct: h.worstDriftPct })),
  });
}
