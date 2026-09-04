import { after } from "next/server";
import { withAdminApi } from "@/lib/app/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paged";

// 10x #5: admin-triggered backfill of EVERY connected account's rollups. S2 (scale): like /api/cron/rollups,
// it now ENQUEUES one durable rollup-account job per account (instead of a serial inline loop that times out
// past ~100 accounts) and kicks the self-chaining drain. Admin-gated; kicks the drain with the env CRON_SECRET.
export const dynamic = "force-dynamic";
export const maxDuration = 60; // only lists + batch-enqueues now (fast); the drain does the work

const INSERT_CHUNK = 500;

export const POST = withAdminApi(async (_ctx, request) => {
  const admin = createAdminClient();
  // S0 (scale plan): page the full list - a bare select caps at 1,000 rows, silently skipping later tenants.
  let accounts: { user_id: string; external_id: string }[];
  try {
    accounts = await readAllPages<{ user_id: string; external_id: string }>((from, to) =>
      admin.from("ad_accounts").select("user_id, external_id").eq("platform", "meta").eq("status", "connected").order("id", { ascending: true }).range(from, to),
    );
  } catch {
    return Response.json({ error: "Could not list accounts." }, { status: 500 });
  }

  const rows = accounts.map((a) => ({ type: "rollup-account", payload: { userId: a.user_id, account: a.external_id }, user_id: a.user_id }));
  let enqueued = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const { error } = await admin.from("jobs").insert(rows.slice(i, i + INSERT_CHUNK));
    if (!error) enqueued += Math.min(INSERT_CHUNK, rows.length - i);
  }

  // Kick the self-chaining drain (best-effort). Admin route -> use the env secret the drain expects; if unset,
  // the jobs stay pending until a drain runs (a periodic drain cron on Pro, S1).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const origin = new URL(request.url).origin;
    after(() => fetch(`${origin}/api/jobs/drain`, { method: "POST", headers: { authorization: `Bearer ${secret}` } }).catch(() => {}));
  }
  return Response.json({ ok: true, accounts: accounts.length, enqueued, drainKicked: !!secret });
});
