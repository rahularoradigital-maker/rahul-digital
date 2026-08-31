import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { listAllAccessibleAdAccounts } from "@/lib/meta-source";

// Lists the ad accounts the connected user can access, for the topbar account
// switcher. Client-fetched (non-blocking) so the layout stays fast. Never leaks the
// token: it stays server-side; only account ids and names are returned.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connected: false, accounts: [] }, { status: 401 });
  const _denied = await guardProductApi();
  if (_denied) return _denied;

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ connected: false, accounts: [] });

  const activeOnly = [{ externalId: session.activeExternalId, name: session.activeAccountName }];
  try {
    // FULL accessible list: direct accounts PLUS every account under the user's Business Managers
    // (owned_ad_accounts + client_ad_accounts). me/adaccounts alone only returns directly-assigned
    // accounts, which is why an agency user with 300+ BM accounts previously saw only a handful.
    const accounts = await listAllAccessibleAdAccounts(session.token);
    // If the token can only see the one granted account (no business_management yet),
    // still return that active account so the switcher renders and offers "connect more".
    return NextResponse.json({
      connected: true,
      activeExternalId: session.activeExternalId,
      accounts: accounts.length > 0 ? accounts : activeOnly,
    });
  } catch {
    return NextResponse.json({ connected: true, activeExternalId: session.activeExternalId, accounts: activeOnly });
  }
}
