import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardProductApi } from "@/lib/app/access";
import { loadCockpit } from "@/lib/app/cockpit-data";
import { gradeRows, type DecisionTripleRow } from "@/lib/intelligence/grade-store";

// The learning-loop OUTCOME job (§112): grade the signed-in user's ripe predictions and fill the empty
// `outcome` half of decision_triples, then return the live accuracy. "Ripe" = the recommendation is old enough
// that the metric has had time to move (>= GRADE_AFTER_DAYS). Each ad's CURRENT ROAS is read from the cockpit
// leaderboard (the top spenders - the ones that matter); rows for ads no longer in that set are skipped, never
// fabricated. Writes the audit `Outcome` shape { measuredAt, metric, before, after } so isLabeled() sees a
// complete triple. Idempotent: only touches rows whose outcome is still null. User-scoped (own tenant only).

export const dynamic = "force-dynamic";
const GRADE_AFTER_DAYS = 7;
const MAX_ROWS = 400;

export async function POST() {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const denied = await guardProductApi(); // post-approval: this loads the cockpit (spend) + writes outcomes
  if (denied) return denied;

  // Current per-ad ROAS from the cockpit (own scope).
  const data = await loadCockpit(30);
  if (!data.connected) return NextResponse.json({ connected: false, graded: 0 });
  const currentRoasByAd: Record<string, number | null> = {};
  for (const ad of data.view.leaderboard) currentRoasByAd[ad.id] = ad.roas;

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - GRADE_AFTER_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data: rowsRaw, error } = await admin
    .from("decision_triples")
    .select("ad_id, time_window, snapshot_day, rule_id, situation, recommendation")
    .eq("user_id", user.id)
    .is("outcome", null)
    .lte("snapshot_day", cutoff)
    .limit(MAX_ROWS);
  if (error) return NextResponse.json({ error: "read failed" }, { status: 500 });
  const rows = (rowsRaw ?? []) as DecisionTripleRow[];

  const { writes, accuracy } = gradeRows(rows, currentRoasByAd);

  // Persist each outcome (audit shape). Per-row update keyed by the full row key; best-effort per row.
  const measuredAt = new Date().toISOString();
  let written = 0;
  await Promise.all(
    writes.map(async (w) => {
      const { error: uErr } = await admin
        .from("decision_triples")
        .update({ outcome: { measuredAt, metric: w.outcome.metric, before: w.outcome.before, after: w.outcome.after } })
        .eq("user_id", user.id)
        .eq("ad_id", w.adId)
        .eq("time_window", w.timeWindow ?? "")
        .eq("snapshot_day", w.snapshotDay ?? "");
      if (!uErr) written++;
    }),
  );

  return NextResponse.json({
    connected: true,
    ripeRows: rows.length,
    graded: written,
    accuracy: { n: accuracy.n, trustworthy: accuracy.trustworthy, hitRate: accuracy.hitRate, byKind: accuracy.byKind, falsePositives: accuracy.falsePositives, falseNegatives: accuracy.falseNegatives },
  });
}
