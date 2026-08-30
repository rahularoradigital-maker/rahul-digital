import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { recordAudit } from "@/lib/security/audit-log";
import { logEvent } from "@/lib/owner/events";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Owner-only: invite a user by email. Supabase sends the invite email + creates the pending user. Admin-gated
// + audited. Delivery depends on the configured email provider (Supabase default until Resend SMTP is set).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let email = "";
  try {
    email = String(((await request.json()) as { email?: string }).email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });

  const redirectTo = `${new URL(request.url).origin}/auth/callback?next=/app`;
  const { error } = await createAdminClient().auth.admin.inviteUserByEmail(email, { redirectTo });
  await recordAudit({ action: "credential.store", actorId: user.id, targetType: "user_invite", targetId: email, result: error ? "error" : "ok", reason: error ? `invite failed: ${error.message}` : "user invited" });
  if (error) return NextResponse.json({ error: `Could not send invite: ${error.message}` }, { status: 400 });
  logEvent("user.invited", { userId: user.id, meta: { email } });
  return NextResponse.json({ ok: true });
}
