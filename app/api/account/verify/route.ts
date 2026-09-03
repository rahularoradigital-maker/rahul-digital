import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { cleanStreak } from "@/lib/rollups/pure";
import { loadVerificationHistory } from "@/lib/rollups/verification";
import { verifyAndLog } from "@/lib/rollups/verify";

// 10x #1 self-proving accuracy (the moat): prove our stored number against an INDEPENDENT source. Diffs the
// precomputed rollup (our store) vs a FRESH live Meta pull via the reconcile engine (match / minor_drift /
// conflict + trustworthy). A conflict means our headline disagrees with Meta - never trust it blindly. The
// diff + logging live in the shared verifyAndLog (also run automatically after each sync); this route adds
// auth + the streak/history read. On-demand only (one aggregate Meta call), off every hot path.
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

  const outcome = await verifyAndLog(user.id, session.activeExternalId, session.token);
  if (!outcome.ok) {
    const note = outcome.reason === "no_rollup" ? "No rollup yet - sync or open the reconcile page first." : "Could not reach Meta to verify right now.";
    const httpStatus = outcome.reason === "meta_unreachable" ? 502 : 200;
    return NextResponse.json({ ok: false, connected: true, reason: outcome.reason, note }, { status: httpStatus });
  }

  const history = await loadVerificationHistory(user.id, session.activeExternalId, 10);
  return NextResponse.json({
    ok: true,
    connected: true,
    account: session.activeAccountName ?? session.activeExternalId,
    window: outcome.window,
    store: outcome.store,
    meta: outcome.meta,
    status: outcome.status, // match | minor_drift | conflict
    trustworthy: outcome.trustworthy, // false => a headline CONFLICTS with Meta: do not trust blindly
    verdict: outcome.summary,
    notes: outcome.notes,
    cleanStreak: cleanStreak(history), // consecutive trustworthy verifications, newest-first
    history: history.slice(0, 5).map((h) => ({ at: h.createdAt, status: h.status, trustworthy: h.trustworthy, worstDriftPct: h.worstDriftPct })),
  });
}
