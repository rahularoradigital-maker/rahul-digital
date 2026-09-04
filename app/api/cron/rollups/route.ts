import { NextResponse, after, type NextRequest } from "next/server";
import { cronSecretGate } from "@/lib/app/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paged";

// 10x #5 instant-app: refresh EVERY connected account's rollup from the STORE (cheap, no Meta call).
// S2 (scale): instead of refreshing all accounts INLINE in this one request (which would time out past ~100
// accounts), ENQUEUE one durable `rollup-account` job per account and kick the drain, which self-chains
// through the whole backlog. Each account is then independently retryable + observable in the `jobs` table.
// The actual refresh work lives in the rollup-account handler (lib/jobs/handlers.ts). CRON_SECRET-gated.
export const dynamic = "force-dynamic";
export const maxDuration = 60; // now only lists + batch-enqueues (fast); the drain does the work

const INSERT_CHUNK = 500; // job rows per insert

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

  // Batch-enqueue one rollup-account job per account (fast; a single insert per chunk). Same shape the queue's
  // enqueue writes ({type, payload, user_id}); status/attempts default. Idempotent handler, so re-enqueues are safe.
  const rows = accounts.map((a) => ({ type: "rollup-account", payload: { userId: a.user_id, account: a.external_id }, user_id: a.user_id }));
  let enqueued = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const { error } = await admin.from("jobs").insert(rows.slice(i, i + INSERT_CHUNK));
    if (!error) enqueued += Math.min(INSERT_CHUNK, rows.length - i);
  }

  // Kick the drain to start processing now; it self-chains through the rest. Best-effort.
  const origin = request.nextUrl.origin;
  after(() => fetch(`${origin}/api/jobs/drain`, { method: "POST", headers: { authorization: `Bearer ${gate.secret}` } }).catch(() => {}));

  return NextResponse.json({ ok: true, accounts: accounts.length, enqueued });
}
