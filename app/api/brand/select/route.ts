import { NextResponse, after, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserContext, canAccessBrand } from "@/lib/tenancy/resolve";
import { getUserMetaSession, bustCockpitCache, fetchLiveCockpit } from "@/lib/meta-sync";

// Switch the active brand. Tenancy is ENFORCED here: we resolve the user's allowed brands and reject any
// brand id they cannot access (even a forged one), then activate that brand's account so the whole cockpit
// analyses it. This is the point where "brands exist" becomes "brands isolate what you can act on".
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const _denied = await guardProductApi();
  if (_denied) return _denied;

  const brandId = request.nextUrl.searchParams.get("id");
  if (!brandId) return NextResponse.redirect(new URL("/app", request.url));

  const ctx = await resolveUserContext(user.id);
  if (!canAccessBrand(ctx, brandId)) return NextResponse.redirect(new URL("/app?brand=denied", request.url));

  // Activate the brand's account (each brand has >=1; pick the primary for now - a per-brand account picker
  // comes when a brand actually holds several). A brand with no connected account yet has nothing to show.
  const acct = ctx.accounts.find((a) => a.brandId === brandId);
  if (!acct) return NextResponse.redirect(new URL("/app?brand=empty", request.url));

  const admin = createAdminClient();
  // One-active-per-user: clear the others, set this one (same mechanism as the account switch).
  await admin.from("ad_accounts").update({ is_active: false }).eq("user_id", user.id).eq("platform", "meta");
  await admin.from("ad_accounts").update({ is_active: true }).eq("id", acct.id);
  await bustCockpitCache(user.id);

  // Warm the newly active brand's cockpit in the background so /app lands on an instant read, not a cold pull.
  try {
    const session = await getUserMetaSession(user.id);
    if (session) after(() => fetchLiveCockpit(user.id, 90).catch(() => {}));
  } catch {
    // after() unavailable outside a request scope; /app will pull on load.
  }

  // Filters belong to the previous brand's account - clear them so the new brand isn't scoped to nothing.
  const res = NextResponse.redirect(new URL("/app", request.url));
  res.cookies.set("adbrain.campaign", "", { path: "/", maxAge: 0 });
  res.cookies.set("adbrain.objectives", "", { path: "/", maxAge: 0 });
  return res;
}
