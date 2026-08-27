import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CockpitView } from "@/lib/cockpit/analyze";

// In-process guard: the DB already dedupes per (user, ad, window, day) via a unique key, but
// every /app navigation would still fire ~100 no-op upserts. Skip a repeat write for the same
// (user, account, window) within this serverless instance's lifetime. The DB stays the source
// of truth across instances; this just avoids redundant round-trips on the hot path.
const recentlyRecorded = new Set<string>();

// Write the current recommendations as labeled triples (the RLEF audit spine): each row is
// (situation, recommendation) for one ad; the operator's judgment and the measured outcome are
// filled in later. Deduped per (user, ad, window, day) by the table's unique key, so calling
// this on every load is a no-op after the first write of the day. Never throws - audit logging
// must not break the page. Call from `after()` so it does not add request latency.
export async function recordDecisionTriples(
  userId: string,
  accountExternalId: string,
  timeWindow: string,
  view: CockpitView,
): Promise<void> {
  const guardKey = `${userId}:${accountExternalId}:${timeWindow}:${new Date().toISOString().slice(0, 10)}`;
  if (recentlyRecorded.has(guardKey)) return;
  recentlyRecorded.add(guardKey);
  try {
    const rows = view.leaderboard.map((ad) => ({
      user_id: userId,
      account_external_id: accountExternalId,
      ad_id: ad.id,
      time_window: timeWindow,
      rule_id: ad.objective === "conversion" ? "verdict" : "decision",
      situation: {
        objective: ad.objective,
        creativeScore: ad.score,
        confidence: ad.confidence,
        fatigue: ad.fatigueRead?.state ?? null,
        spendRs: ad.spendRs,
        roas: ad.roas,
        halfLifeDays: ad.halfLifeDays ?? null,
      },
      recommendation: {
        action: ad.action.label,
        priority: ad.action.priority,
        confidence: ad.confidence,
        why: ad.why,
      },
    }));
    if (rows.length === 0) return;
    const admin = createAdminClient();
    await admin
      .from("decision_triples")
      .upsert(rows, { onConflict: "user_id,ad_id,time_window,snapshot_day", ignoreDuplicates: true });
  } catch {
    // audit logging is best-effort; a failure here must never affect the dashboard
  }
}
