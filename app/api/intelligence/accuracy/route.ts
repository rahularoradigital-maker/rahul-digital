import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardProductApi } from "@/lib/app/access";
import { accuracyFromTriples, type GradedTripleRow } from "@/lib/intelligence/accuracy-from-triples";

// The moat, made visible (§115): "AdScale's calls were right N% of the time" - the CUMULATIVE accuracy across
// all graded decisions for the signed-in account. Reads only rows the grade job has scored (outcome filled);
// below MIN_SAMPLE the hit-rate is honestly withheld (null) rather than shown off too few calls. Read-only,
// own-tenant. A trustworthy number here is the strongest trust signal the product can give.

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  const { data: rowsRaw, error } = await createAdminClient()
    .from("decision_triples")
    .select("ad_id, rule_id, recommendation, outcome")
    .eq("user_id", user.id)
    .not("outcome", "is", null)
    .limit(5000);
  if (error) return NextResponse.json({ error: "read failed" }, { status: 500 });

  const rows = (rowsRaw ?? []) as GradedTripleRow[];
  const accuracy = accuracyFromTriples(rows);
  return NextResponse.json({
    gradedDecisions: rows.length,
    countedInAccuracy: accuracy.n, // gradeable ones (keep-spending calls)
    trustworthy: accuracy.trustworthy, // n >= MIN_SAMPLE
    hitRate: accuracy.hitRate, // null until trustworthy
    byKind: accuracy.byKind,
    falsePositives: accuracy.falsePositives,
    falseNegatives: accuracy.falseNegatives,
  });
}
