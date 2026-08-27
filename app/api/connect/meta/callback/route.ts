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

  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  if (!code) return NextResponse.redirect(new URL("/app?connect=error", request.url));

  // CSRF: the `state` Meta echoes back must match the httpOnly cookie set in /authorize.
  // A missing or mismatched state means this callback was not initiated by this browser -
  // reject it so an attacker cannot link their Meta account to the victim's AdBrain account.
  const stateParam = params.get("state");
  const stateCookie = request.cookies.get("meta_oauth_state")?.value;
  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return NextResponse.redirect(new URL("/app?connect=error", request.url));
  }

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
  let body: { access_token?: string; expires_in?: number };
  try {
    const res = await fetch(tokenUrl.toString());
    if (!res.ok) return NextResponse.redirect(new URL("/app?connect=error", request.url));
    body = (await res.json()) as { access_token?: string; expires_in?: number };
  } catch {
    // A network error or non-JSON body from Meta must redirect, not 500 the callback.
    return NextResponse.redirect(new URL("/app?connect=error", request.url));
  }
  if (!body.access_token) return NextResponse.redirect(new URL("/app?connect=error", request.url));

  // Exchange the short-lived token (~1-2h) for a long-lived one (~60 days). Without this the
  // connection would silently expire within the hour and the cockpit would fall back to the
  // Connect screen. Best-effort: keep the short-lived token if the exchange fails.
  let accessToken = body.access_token;
  let expiresIn = body.expires_in;
  try {
    const llUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    llUrl.searchParams.set("grant_type", "fb_exchange_token");
    llUrl.searchParams.set("client_id", appId);
    llUrl.searchParams.set("client_secret", appSecret);
    llUrl.searchParams.set("fb_exchange_token", body.access_token);
    const llRes = await fetch(llUrl.toString());
    if (llRes.ok) {
      const ll = (await llRes.json()) as { access_token?: string; expires_in?: number };
      if (ll.access_token) {
        accessToken = ll.access_token;
        expiresIn = ll.expires_in;
      }
    }
  } catch {
    // keep the short-lived token
  }

  // Resolve the user's REAL Meta ad account(s) and store the first one. (Account picker
  // for multiple accounts is a follow-up; v1 connects the first accessible account.)
  const token = { accessToken };
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
    accessToken,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
  });
  return NextResponse.redirect(new URL("/app?connect=ok", request.url));
}
