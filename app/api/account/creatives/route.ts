import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { loadCreativeRollup, refreshCreativeRollup } from "@/lib/rollups/creative";
import type { CreativeFlag } from "@/lib/rollups/creative-pure";

const FLAGS: readonly CreativeFlag[] = ["winner", "wasting", "steady"];

// 10x #5 instant-app: the account's top creatives (by spend) from the precomputed creative rollup - one row,
// no ad_metrics scan. Self-heals: if no fresh rollup exists it computes + stores one, then returns it (so the
// first call after a deploy/sync populates it and every later call is instant). Auth + product gated.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ ready: false, connected: false, top: [] });

  let rollup = await loadCreativeRollup(user.id, session.activeExternalId);
  if (!rollup) {
    // self-heal: compute + store, then read back. If the store is empty (never synced), stays not-ready.
    const ok = await refreshCreativeRollup(user.id, session.activeExternalId);
    rollup = ok ? await loadCreativeRollup(user.id, session.activeExternalId) : null;
  }
  if (!rollup) return NextResponse.json({ ready: false, connected: true, top: [] });

  // Optional ?flag=winner|wasting|steady filter, applied over the stored top (no recompute).
  const flagParam = request.nextUrl.searchParams.get("flag");
  const flag = FLAGS.includes(flagParam as CreativeFlag) ? (flagParam as CreativeFlag) : null;
  const top = flag ? rollup.top.filter((c) => c.flag === flag) : rollup.top;

  return NextResponse.json({
    ready: true,
    connected: true,
    account: session.activeAccountName ?? session.activeExternalId,
    computedAt: rollup.computedAt,
    count: rollup.count,
    filter: flag,
    top,
  });
}
