import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { guardProductApi } from "@/lib/app/access";
import { getUserMetaSession } from "@/lib/meta-sync";
import { addToShortlist, removeFromShortlist, loadShortlistIds } from "@/lib/influencer/shortlist";

// Save / unsave a creator to the account's shortlist (spec §28). Post-approval (guardProductApi), and the
// account is resolved from the CALLER's own session - never client-supplied - so a write can only ever land
// on the user's own account rows. Draft-only in spirit: this is the user's private shortlist, nothing is sent
// anywhere. GET returns the current shortlisted ids so the UI can mark saved state.
export const dynamic = "force-dynamic";

// Resolve the caller's own user + active account (auth + session). The product-access GATE is called in each
// method body below (not here) so check-access-gate can see guardProductApi() per handler - a helper-only gate
// reads as a bypass to the linter and, worse, is easy to forget on a new method.
async function resolveUserAccount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  const session = await getUserMetaSession(user.id);
  if (!session) return { error: NextResponse.json({ ok: false, error: "Connect a Meta account first." }, { status: 400 }) };
  return { userId: user.id, account: session.activeExternalId };
}

export async function GET() {
  const denied = await guardProductApi();
  if (denied) return denied;
  const ctx = await resolveUserAccount();
  if ("error" in ctx) return ctx.error;
  const ids = await loadShortlistIds(ctx.userId, ctx.account);
  return NextResponse.json({ ok: true, ids: [...ids] });
}

export async function POST(request: Request) {
  const denied = await guardProductApi();
  if (denied) return denied;
  const ctx = await resolveUserAccount();
  if ("error" in ctx) return ctx.error;

  const body = (await request.json().catch(() => ({}))) as { platformUserId?: string; platform?: string; action?: string };
  const platformUserId = typeof body.platformUserId === "string" ? body.platformUserId.trim() : "";
  const platform = typeof body.platform === "string" && body.platform.trim() ? body.platform.trim() : "instagram";
  const action = body.action === "remove" ? "remove" : "add";
  if (!platformUserId) return NextResponse.json({ ok: false, error: "platformUserId required" }, { status: 400 });

  try {
    if (action === "add") await addToShortlist(ctx.userId, ctx.account, platform, platformUserId);
    else await removeFromShortlist(ctx.userId, ctx.account, platform, platformUserId);
    return NextResponse.json({ ok: true, shortlisted: action === "add" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Shortlist update failed" }, { status: 500 });
  }
}
