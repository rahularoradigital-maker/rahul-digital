import { NextResponse } from "next/server";

// Start Meta OAuth: redirect the user to the consent dialog. Requires META_APP_ID +
// META_REDIRECT_URI (set once the owner creates the Meta developer app).
export async function GET() {
  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!appId || !redirectUri) {
    return NextResponse.json({ error: "Meta OAuth not configured" }, { status: 501 });
  }
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "ads_read");
  url.searchParams.set("response_type", "code");
  return NextResponse.redirect(url.toString());
}
