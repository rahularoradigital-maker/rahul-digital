import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { listMetaCampaigns } from "@/lib/meta-source";

// Active campaigns in the user's active ad account, for the topbar campaign filter.
// Client-fetched (non-blocking). Token stays server-side.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ campaigns: [] }, { status: 401 });

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ campaigns: [] });

  try {
    const campaigns = await listMetaCampaigns(session.activeExternalId, session.token);
    return NextResponse.json({ campaigns });
  } catch {
    return NextResponse.json({ campaigns: [] });
  }
}
