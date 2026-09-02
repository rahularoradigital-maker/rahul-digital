import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserMetaSession, bustCockpitCache, fetchLiveCockpit } from "@/lib/meta-sync";
import { listAllAccessibleAdAccounts } from "@/lib/meta-source";
import { storeToken } from "@/lib/oauth-store";
import { logEvent } from "@/lib/owner/events";
import { autoDeriveBrandDraft } from "@/lib/brand/auto";
import { captureError } from "@/lib/observability";

// Switch the active ad account. One user OAuth token works across all their accounts,
// so we upsert the chosen account with a fresh connected_at (making it the most-recent,
// which fetchLiveCockpit reads) and store the same token against it. Then back to /app.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const _denied = await guardProductApi();
  if (_denied) return _denied;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.redirect(new URL("/app", request.url));

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.redirect(new URL("/app?connect=error", request.url));

  // ISSUE 14: never turn a URL-supplied account id into a switch without proving the current token
  // can actually reach it. Verify against the token's accessible accounts (the same source the picker
  // is built from) and use the SERVER-resolved name, not a caller-supplied one. Fail closed if the
  // reachable set can't be fetched - an authorization decision must not proceed on unverifiable state.
  let accessible;
  try {
    accessible = await listAllAccessibleAdAccounts(session.token);
  } catch {
    return NextResponse.redirect(new URL("/app?connect=error", request.url));
  }
  const match = accessible.find((a) => a.externalId === id);
  if (!match) return NextResponse.redirect(new URL("/app?connect=denied", request.url));

  const admin = createAdminClient();
  const { data: acct, error } = await admin
    .from("ad_accounts")
    .upsert(
      { user_id: user.id, platform: "meta", external_id: id, name: match.name, status: "connected", connected_at: new Date().toISOString() },
      { onConflict: "user_id,platform,external_id" },
    )
    .select("id")
    .single();
  if (error || !acct) return NextResponse.redirect(new URL("/app?connect=error", request.url));

  // ISSUE 25: mark this the EXPLICIT active account. Clear the user's others first (the
  // one-active-per-user index rejects two actives), then set this one. connected_at stays as history,
  // so a later reconnect / background write can no longer silently change which account is active.
  await admin.from("ad_accounts").update({ is_active: false }).eq("user_id", user.id).eq("platform", "meta");
  await admin.from("ad_accounts").update({ is_active: true }).eq("id", acct.id);

  try {
    await storeToken(acct.id, session.token);
  } catch {
    // storeToken throws on a DB/encryption failure; degrade to a graceful error redirect rather than
    // an unhandled 500 mid-switch.
    return NextResponse.redirect(new URL("/app?connect=error", request.url));
  }
  // Bust the cached cockpit (both levels) so the newly selected account shows immediately.
  await bustCockpitCache(user.id);
  logEvent("connector.connected", { userId: user.id, feature: "meta", meta: { account: id } }); // owner-analytics


  // AUTO-PROCESS on account switch: in the BACKGROUND (the just-upserted account is now the
  // most-recent = active) warm the new account's cockpit cache, THEN auto-learn the brand from that
  // warm data. By the time the browser lands on /app the cockpit is usually ready (instant, not a cold
  // pull), and Market > Brand already has a DRAFT profile waiting to review. Both are best-effort.
  try {
    after(async () => {
      await fetchLiveCockpit(user.id, 90).catch((e) => captureError(e, { fn: "meta.select-account.warm" })); // warm the app-wide 90-day window first
      await autoDeriveBrandDraft(user.id, id, match.name, session.token).catch((e) => captureError(e, { fn: "meta.select-account.brandDraft" })); // reuse warm ads
    });
  } catch (e) {
    captureError(e, { fn: "meta.select-account" }); // P1 observability: was a silent empty catch (fail-open preserved)
    // after() unavailable outside a request scope; the /app load will pull, and Brand can learn on demand.
  }
  // Clear campaign + objective filters: both belong to the previous account and would otherwise
  // scope the new account to nothing / an objective it may not have.
  const res = NextResponse.redirect(new URL("/app", request.url));
  res.cookies.set("adbrain.campaign", "", { path: "/", maxAge: 0 });
  res.cookies.set("adbrain.objectives", "", { path: "/", maxAge: 0 });
  return res;
}
