import { withAdminApi } from "@/lib/app/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccountRollup } from "@/lib/rollups/account";
import { refreshCreativeRollup } from "@/lib/rollups/creative";

// 10x #5: admin-triggered backfill of EVERY connected account's rollups (account + creative) from the store.
// Same work as /api/cron/rollups, but gated by admin session instead of CRON_SECRET - so an operator can warm
// rollups on demand (e.g. right after a deploy) without the cron secret. Reads the store only, no Meta call.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withAdminApi(async () => {
  const admin = createAdminClient();
  const { data, error } = await admin.from("ad_accounts").select("user_id, external_id").eq("platform", "meta").eq("status", "connected");
  if (error) return Response.json({ error: "Could not list accounts." }, { status: 500 });

  const accounts = (data ?? []) as { user_id: string; external_id: string }[];
  let refreshed = 0;
  let empty = 0;
  for (const a of accounts) {
    const ok = await refreshAccountRollup(a.user_id, a.external_id);
    await refreshCreativeRollup(a.user_id, a.external_id).catch(() => {});
    if (ok) refreshed++;
    else empty++; // never synced -> nothing in the store to roll up
  }
  return Response.json({ ok: true, accounts: accounts.length, refreshed, empty });
});
