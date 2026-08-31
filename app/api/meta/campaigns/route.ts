import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { listMetaCampaigns, mapMetaObjective } from "@/lib/meta-source";

// Active campaigns in the user's active ad account, for the topbar campaign filter.
// Client-fetched (non-blocking). Token stays server-side.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ campaigns: [] }, { status: 401 });
  const _denied = await guardProductApi();
  if (_denied) return _denied;

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ campaigns: [] });

  try {
    const campaigns = await listMetaCampaigns(session.activeExternalId, session.token);
    // Return the INTERNAL objective (conversion / traffic / ...) so the campaign switcher can
    // filter to the objective the user picked (the objective cookie stores internal values, not
    // Meta's raw OUTCOME_* strings).
    const mapped = campaigns.map((c) => ({ id: c.id, name: c.name, objective: mapMetaObjective(c.objective) }));
    return NextResponse.json({ campaigns: mapped });
  } catch {
    return NextResponse.json({ campaigns: [] });
  }
}
