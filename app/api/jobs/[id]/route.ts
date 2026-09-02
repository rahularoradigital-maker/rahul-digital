import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Own-user job status (cleanup #4). Lets a client that enqueued a background job poll its progress
// (pending | claimed | done | dead). Scoped to the CALLER's own user_id: the jobs table is service-role only
// (deny-RLS), and this reads via the admin client but filters by the authenticated user, so a user can only
// see their own jobs (never another tenant's, never system jobs with a null user_id).
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data } = await createAdminClient()
    .from("jobs")
    .select("id, type, status, attempts, last_error, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = data as { id: string; type: string; status: string; attempts: number; last_error: string | null; updated_at: string };
  return NextResponse.json({
    job,
    done: job.status === "done",
    failed: job.status === "dead",
  });
}
