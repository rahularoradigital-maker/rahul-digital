import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { storeToken } from "@/lib/oauth-store";
import { listMetaAdAccounts } from "@/lib/meta-source";

// Meta OAuth callback: exchange the code for a token, create an ad_accounts row, store the
// ENCRYPTED token. Token values are never returned to the client (audit F4 boundary).
// Untested until the owner's Meta app exists (env-gated with a 501).
export async function GET(request: NextRequest) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    return NextResponse.json({ error: "Meta OAuth not configured" }, { status: 501 });
  }

  const code = new URL(request.url).searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/app?connect=error", request.url));

  // Owner of the connection = the logged-in user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // Exchange the code for an access token.
  const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);
  const res = await fetch(tokenUrl.toString());
  if (!res.ok) return NextResponse.redirect(new URL("/app?connect=error", request.url));
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) return NextResponse.redirect(new URL("/app?connect=error", request.url));

  // Resolve the user's REAL Meta ad account(s) and store the first one. (Account picker
  // for multiple accounts is a follow-up; v1 connects the first accessible account.)
  const token = { accessToken: body.access_token };
  let accounts: { externalId: string; name: string }[] = [];
  try {
    accounts = await listMetaAdAccounts(token);
  } catch {
    return NextResponse.redirect(new URL("/app?connect=error", request.url));
  }
  if (accounts.length === 0) return NextResponse.redirect(new URL("/app?connect=no_accounts", request.url));
  const chosen = accounts[0];

  const admin = createAdminClient();
  const { data: acct, error: acctErr } = await admin
    .from("ad_accounts")
    .upsert(
      { user_id: user.id, platform: "meta", external_id: chosen.externalId, name: chosen.name, status: "connected" },
      { onConflict: "user_id,platform,external_id" },
    )
    .select("id")
    .single();
  if (acctErr || !acct) return NextResponse.redirect(new URL("/app?connect=error", request.url));

  await storeToken(acct.id, {
    accessToken: body.access_token,
    expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : undefined,
  });
  return NextResponse.redirect(new URL("/app?connect=ok", request.url));
}
