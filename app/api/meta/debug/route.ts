import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";

// TEMPORARY diagnostic: dumps the raw Meta Graph responses for the connected token so we
// can see exactly why the account list is empty (granted permissions, /me/adaccounts,
// /me/businesses, and each business's owned + client ad accounts, with per-call errors).
// Authed to the logged-in user only. Remove once the agency-account issue is resolved.
const GRAPH = "https://graph.facebook.com/v21.0";

async function call(token: string, path: string, params: Record<string, string> = {}) {
  try {
    const url = new URL(`${GRAPH}/${path}`);
    url.searchParams.set("access_token", token);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const r = await fetch(url.toString(), { cache: "no-store" });
    return { status: r.status, body: await r.json() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ error: "no meta session" });
  const token = session.token.accessToken;

  const permissions = await call(token, "me/permissions");
  const me = await call(token, "me", { fields: "id,name" });
  const adaccounts = await call(token, "me/adaccounts", { fields: "account_id,name", limit: "250" });
  const businesses = await call(token, "me/businesses", { fields: "id,name", limit: "100" });

  const businessEdges: Record<string, unknown> = {};
  const biz = (businesses as { body?: { data?: { id: string; name?: string }[] } }).body?.data ?? [];
  for (const b of biz.slice(0, 20)) {
    businessEdges[`${b.name ?? ""} (${b.id})`] = {
      owned: await call(token, `${b.id}/owned_ad_accounts`, { fields: "account_id,name", limit: "250" }),
      client: await call(token, `${b.id}/client_ad_accounts`, { fields: "account_id,name", limit: "250" }),
    };
  }

  return NextResponse.json(
    {
      activeExternalId: session.activeExternalId,
      me,
      permissions,
      adaccounts_count: (adaccounts as { body?: { data?: unknown[] } }).body?.data?.length ?? "n/a",
      adaccounts,
      businesses_count: biz.length,
      businesses,
      businessEdges,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
