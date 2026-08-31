import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { recordAudit } from "@/lib/security/audit-log";
import { logEvent } from "@/lib/owner/events";

// Owner-only: change a user's private-beta access state. Admin-gated + audited. Service-role write (the only
// path allowed to mutate profiles.access_state; users have no self-update policy). GET lists the roster.
const ACTION_TO_STATE = { approve: "APPROVED", reinstate: "APPROVED", suspend: "SUSPENDED", revoke: "REVOKED" } as const;
type Action = keyof typeof ACTION_TO_STATE;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id,email,access_state,approved_at,created_at,state_reason")
    .order("created_at", { ascending: false })
    .limit(500);
  return NextResponse.json({ users: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { userId?: string; action?: string; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const userId = String(body.userId ?? "").trim();
  const action = String(body.action ?? "") as Action;
  const reason = body.reason ? String(body.reason).slice(0, 500) : null;
  if (!userId || !(action in ACTION_TO_STATE)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const state = ACTION_TO_STATE[action];
  const patch: Record<string, unknown> = { access_state: state, updated_at: new Date().toISOString(), state_reason: reason };
  if (state === "APPROVED") { patch.approved_by = user.id; patch.approved_at = new Date().toISOString(); }

  const admin = createAdminClient();
  const { data: before } = await admin.from("profiles").select("access_state").eq("id", userId).maybeSingle();
  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  const auditAction = action === "suspend" || action === "revoke" ? "user.suspend" : "credits.grant";
  await recordAudit({ action: auditAction, actorId: user.id, targetType: "user", targetId: userId,
    before: before ?? undefined, after: { access_state: state }, result: error ? "error" : "ok", reason: reason ?? `access ${action}` });
  if (error) return NextResponse.json({ error: `Could not update: ${error.message}` }, { status: 400 });
  logEvent(`access.${action}`, { userId: user.id, meta: { targetUserId: userId, state } });
  return NextResponse.json({ ok: true, state });
}
