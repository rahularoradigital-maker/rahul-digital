import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Influencer shortlist persistence (spec §28: Discovered -> Shortlisted). The influencer_shortlist table
// (migration 0007) has existed since day one but was never wired to anything - so a user could rank creators
// and had no way to KEEP the ones they liked. This is the thin, tenancy-safe store behind a Save action.
// Service-role only (RLS default-deny); every query is scoped by user_id + account_external_id in code, so a
// user can only ever read/write their own account's shortlist. We store a lightweight reference (the creator
// key), not a snapshot - the creator's data lives in the run and on the profile, and is re-read there.

export async function addToShortlist(userId: string, accountExternalId: string, platform: string, platformUserId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("influencer_shortlist")
    .upsert(
      { user_id: userId, account_external_id: accountExternalId, platform, platform_user_id: platformUserId, stage: "shortlisted", updated_at: new Date().toISOString() },
      { onConflict: "user_id,account_external_id,platform,platform_user_id" },
    );
  if (error) throw new Error(`shortlist.add: ${error.message}`);
}

export async function removeFromShortlist(userId: string, accountExternalId: string, platform: string, platformUserId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("influencer_shortlist")
    .delete()
    .eq("user_id", userId)
    .eq("account_external_id", accountExternalId)
    .eq("platform", platform)
    .eq("platform_user_id", platformUserId);
  if (error) throw new Error(`shortlist.remove: ${error.message}`);
}

// The platform_user_ids currently shortlisted for this account - lets the UI mark which creators are saved
// without shipping the whole shortlist. Scoped by user + account. Empty set on any error (never throws into
// the page render).
export async function loadShortlistIds(userId: string, accountExternalId: string): Promise<Set<string>> {
  try {
    const { data } = await createAdminClient()
      .from("influencer_shortlist")
      .select("platform_user_id")
      .eq("user_id", userId)
      .eq("account_external_id", accountExternalId);
    return new Set(((data ?? []) as { platform_user_id: string }[]).map((r) => r.platform_user_id));
  } catch {
    return new Set();
  }
}

export type ShortlistRow = { platform: string; platform_user_id: string; stage: string; note: string | null; updated_at: string };

// The full shortlist for a shortlist view (newest first). Scoped by user + account.
export async function loadShortlist(userId: string, accountExternalId: string): Promise<ShortlistRow[]> {
  const { data } = await createAdminClient()
    .from("influencer_shortlist")
    .select("platform, platform_user_id, stage, note, updated_at")
    .eq("user_id", userId)
    .eq("account_external_id", accountExternalId)
    .order("updated_at", { ascending: false });
  return (data ?? []) as ShortlistRow[];
}
