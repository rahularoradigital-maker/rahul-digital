import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardProductApi } from "@/lib/app/access";
import { getUserMetaSession } from "@/lib/meta-sync";
import { loadBrandProfile } from "@/lib/brand/profile";
import { firstRunStage, firstRunProgress } from "@/lib/onboarding/stage";

// First-run status (10x #8): the honest, cheap answer to "where is this user on the way to a first insight?".
// A client island polls this during onboarding so the silent post-setup wait ("Still syncing") becomes a
// visible "Building your first insight..." with progress, and the page can auto-advance the moment data lands.
// Auth-gated. Reads only tiny existence/flags - never runs a sync, never blocks. Honest: missing = false.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi(); // post-approval only (onboarding lives inside /app); keeps check:access-gate green
  if (denied) return denied;

  const session = await getUserMetaSession(user.id);
  const metaConnected = !!session;

  let brandConfirmed = false;
  let hasData = false;
  if (session) {
    const profile = await loadBrandProfile(user.id, session.activeExternalId);
    brandConfirmed = !!profile && (!!profile.category || profile.keyProducts.length > 0);
    // hasData: the store holds at least one ad for the active account (i.e. the first sync landed). Cheapest
    // possible probe - select one id, head count. Never fabricates: on any error hasData stays false (honest).
    const { count } = await createAdminClient()
      .from("ad_meta")
      .select("ad_id", { count: "exact", head: true })
      .eq("user_id", user.id) // tenancy: scope to THIS user, never count another tenant's rows for the same account id
      .eq("account_external_id", session.activeExternalId);
    hasData = (count ?? 0) > 0;
  }

  const signals = { metaConnected, brandConfirmed, hasData };
  const stage = firstRunStage(signals);
  return NextResponse.json({
    ...signals,
    stage,
    progress: firstRunProgress(signals),
    ready: stage === "ready",
    accountName: session?.activeAccountName ?? null,
  });
}
