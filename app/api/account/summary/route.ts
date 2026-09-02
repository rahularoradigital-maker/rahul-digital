import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { loadAccountRollup } from "@/lib/rollups/account";

// 10x #5 instant-app: the active account's whole-account headline read from the precomputed rollup - a single
// indexed row, no ad_metrics scan. Instant by design: if no fresh rollup exists yet (account not synced), it
// returns { ready:false } rather than paying for a cold scan, so callers (e.g. the onboarding "still syncing"
// screen) can poll cheaply and light up the moment the first sync lands the rollup. Auth + product gated.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ ready: false, connected: false });

  const rollup = await loadAccountRollup(user.id, session.activeExternalId);
  if (!rollup) return NextResponse.json({ ready: false, connected: true });

  return NextResponse.json({
    ready: true,
    connected: true,
    account: session.activeAccountName ?? session.activeExternalId,
    computedAt: rollup.computedAt,
    headline: {
      spend: rollup.spend,
      revenue: rollup.revenue,
      purchases: rollup.purchases,
      ads: rollup.ads,
      roas: rollup.spend > 0 ? rollup.revenue / rollup.spend : null,
    },
  });
}
