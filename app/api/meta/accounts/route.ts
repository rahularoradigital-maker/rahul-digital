import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { listMetaAdAccounts } from "@/lib/meta-source";

// Lists the ad accounts the connected user can access, for the topbar account
// switcher. Client-fetched (non-blocking) so the layout stays fast. Never leaks the
// token: it stays server-side; only account ids and names are returned.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connected: false, accounts: [] }, { status: 401 });

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ connected: false, accounts: [] });

  try {
    const accounts = await listMetaAdAccounts(session.token);
    return NextResponse.json({ connected: true, activeExternalId: session.activeExternalId, accounts });
  } catch {
    // Fall back to just the active account so the switcher still shows the current one.
    return NextResponse.json({
      connected: true,
      activeExternalId: session.activeExternalId,
      accounts: [{ externalId: session.activeExternalId, name: session.activeAccountName }],
    });
  }
}
