import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { storeToken } from "@/lib/oauth-store";
import { listAllAccessibleAdAccounts } from "@/lib/meta-source";
import { recordAudit } from "@/lib/security/audit-log";
import { captureError } from "@/lib/observability";

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
  // reject it so an attacker cannot link their Meta account to the victim's AdScale account.
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
  const _denied = await guardProductApi();
  if (_denied) return _denied;

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
  } catch (e) {
    captureError(e, { fn: "meta.callback" }); // P1 observability: was a silent empty catch (fail-open preserved)
    // keep the short-lived token
  }

  // Resolve the user's REAL Meta ad account(s) and store the first one. (Account picker
  // for multiple accounts is a follow-up; v1 connects the first accessible account.)
  const token = { accessToken };
  let accounts: { externalId: string; name: string }[] = [];
  try {
    // Full accessible list (direct + Business Manager owned/client accounts), so a user whose accounts
    // all live under a BM can still connect, and the initial pick is not limited to directly-assigned ones.
    accounts = await listAllAccessibleAdAccounts(token);
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

  // ISSUE 25: a freshly connected account becomes the explicit active one. Clear the user's others
  // first (one-active-per-user index), then set this one.
  await admin.from("ad_accounts").update({ is_active: false }).eq("user_id", user.id).eq("platform", "meta");
  await admin.from("ad_accounts").update({ is_active: true }).eq("id", acct.id);

  try {
    await storeToken(acct.id, {
      accessToken,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
    });
  } catch {
    // storeToken throws on a DB/encryption failure; degrade to the same graceful error redirect the
    // rest of this route uses instead of an unhandled 500 that leaves the OAuth flow in limbo.
    await recordAudit({ action: "credential.store", actorId: user.id, targetType: "ad_account", targetId: acct.id, after: { platform: "meta", externalId: chosen.externalId }, result: "error", reason: "meta oauth token store failed" });
    return NextResponse.redirect(new URL("/app?connect=error", request.url));
  }
  // Audit spine: a customer credential was stored (the token value itself is never logged, only the fact).
  await recordAudit({ action: "credential.store", actorId: user.id, targetType: "ad_account", targetId: acct.id, after: { platform: "meta", externalId: chosen.externalId, expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null } });
  return NextResponse.redirect(new URL("/app?connect=ok", request.url));
}
