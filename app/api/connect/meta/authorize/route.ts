import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

// Start Meta OAuth: redirect the user to the consent dialog. Requires META_APP_ID +
// META_REDIRECT_URI (set once the owner creates the Meta developer app).
export async function GET() {
  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!appId || !redirectUri) {
    return NextResponse.json({ error: "Meta OAuth not configured" }, { status: 501 });
  }
  // CSRF protection: a random `state` echoed by Meta and matched against an httpOnly cookie in
  // the callback. Without it, an attacker can trick a logged-in victim into linking the
  // ATTACKER'S Meta account to the victim's AdBrain account (OAuth account-linking CSRF).
  const state = randomBytes(16).toString("hex");
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  // ads_read: read the account's ads and insights. business_management: enumerate the
  // agency's other ad accounts (owned + client) so the user can switch between them.
  url.searchParams.set("scope", "ads_read,business_management");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url.toString());
  res.cookies.set("meta_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600 });
  return res;
}
