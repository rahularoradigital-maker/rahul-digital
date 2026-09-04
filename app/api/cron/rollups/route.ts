import { NextResponse, type NextRequest } from "next/server";
import { cronSecretGate } from "@/lib/app/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paged";
import { refreshAccountRollup } from "@/lib/rollups/account";
import { refreshCreativeRollup } from "@/lib/rollups/creative";
import { captureError } from "@/lib/observability";

// 10x #5 instant-app: refresh EVERY connected account's rollup from the STORE. This is deliberately separate
// from /api/cron/sync: a rollup reads ad_metrics/ad_meta that are already in the DB, so it is cheap and makes
// no Meta call - it can run far more often than the heavy nightly Meta sync to keep dashboards instant even
// between syncs. CRON_SECRET-gated (same primitive as the other crons). Inert until CRON_SECRET is set.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONCURRENCY = 4; // store reads only; bounded so a large tenant list never floods the pool

export async function GET(request: NextRequest) {
  const gate = cronSecretGate(request);
  if (!gate.ok) return gate.response;

  const admin = createAdminClient();
  // S0 (scale plan): page the full list - a bare select caps at 1,000 rows, silently skipping later tenants.
  let accounts: { user_id: string; external_id: string }[];
  try {
    accounts = await readAllPages<{ user_id: string; external_id: string }>((from, to) =>
      admin.from("ad_accounts").select("user_id, external_id").eq("platform", "meta").eq("status", "connected").order("id", { ascending: true }).range(from, to),
    );
  } catch {
    return NextResponse.json({ error: "Could not list accounts." }, { status: 500 });
  }
  const queue = [...accounts];
  let refreshed = 0;
  let empty = 0;
  let failed = 0;

  async function worker() {
    for (;;) {
      const a = queue.shift();
      if (!a) return;
      try {
        const ok = await refreshAccountRollup(a.user_id, a.external_id);
        await refreshCreativeRollup(a.user_id, a.external_id).catch(() => {}); // same store read, top-creatives rollup
        if (ok) refreshed++;
        else empty++; // no store rows yet for this account (never synced) - nothing to roll up
      } catch (e) {
        failed++;
        captureError(e, { route: "cron/rollups", account: a.external_id });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, queue.length)) }, worker));

  return NextResponse.json({ ok: true, accounts: accounts.length, refreshed, empty, failed });
}
