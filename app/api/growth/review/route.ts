import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { setDraftStatus } from "@/lib/growth/store";
import { recordAudit } from "@/lib/security/audit-log";

// Owner-only: record your review decision on one queued draft (approve / dismiss / posted). It changes STATUS
// only - it never posts anything to any platform. Audited. Gated by ADMIN_EMAILS (Scout is owner-internal).

const VALID = new Set(["approved", "dismissed", "posted"]);

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? null;
  if (!user || !email || !isAdminEmail(email)) return NextResponse.json({ ok: false, error: "Admins only" }, { status: 403 });

  let body: { id?: string; action?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const { id, action } = body;
  if (!id || !action || !VALID.has(action)) return NextResponse.json({ ok: false, error: "Missing or invalid fields" }, { status: 400 });

  const ok = await setDraftStatus(id, action as "approved" | "dismissed" | "posted", user.id);
  if (!ok) return NextResponse.json({ ok: false, error: "Draft not found" }, { status: 404 });

  await recordAudit({ action: "growth.review", actorId: user.id, actorRole: "admin", targetType: "growth_draft", targetId: id, after: { status: action }, reason: "Scout draft review (no external post)" });
  return NextResponse.json({ ok: true });
}
