import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { guardProductApi } from "@/lib/app/access";
import { requestAccountDeletion, cancelAccountDeletion } from "@/lib/account/deletion";

// Self-serve account deletion (Rahul's decision: soft-delete + 14-day grace, Cancel aborts). POST schedules
// the deletion for the SIGNED-IN user only (never another tenant) and revokes Meta now; DELETE cancels a
// pending request within the grace. The irreversible purge is NOT done here - the cron runs it after the grace
// (app/api/cron/purge-deletions). Product-gated + own-user, so no one can schedule anyone else's deletion.
export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  const res = await requestAccountDeletion(user.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true, purgeAfter: res.purgeAfter });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  const cancelled = await cancelAccountDeletion(user.id);
  return NextResponse.json({ ok: true, cancelled });
}
