import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserMetaSession } from "@/lib/meta-sync";
import { storeToken } from "@/lib/oauth-store";

// Switch the active ad account. One user OAuth token works across all their accounts,
// so we upsert the chosen account with a fresh connected_at (making it the most-recent,
// which fetchLiveCockpit reads) and store the same token against it. Then back to /app.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const name = url.searchParams.get("name") ?? (id ? `act_${id}` : "");
  if (!id) return NextResponse.redirect(new URL("/app", request.url));

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.redirect(new URL("/app?connect=error", request.url));

  const admin = createAdminClient();
  const { data: acct, error } = await admin
    .from("ad_accounts")
    .upsert(
      { user_id: user.id, platform: "meta", external_id: id, name, status: "connected", connected_at: new Date().toISOString() },
      { onConflict: "user_id,platform,external_id" },
    )
    .select("id")
    .single();
  if (error || !acct) return NextResponse.redirect(new URL("/app?connect=error", request.url));

  await storeToken(acct.id, session.token);
  return NextResponse.redirect(new URL("/app", request.url));
}
