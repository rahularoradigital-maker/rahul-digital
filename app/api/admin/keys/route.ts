import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { isManagedKey, setKey, deleteKey } from "@/lib/keys";
import { recordAudit } from "@/lib/security/audit-log";

// Owner-only: set / rotate / remove a MANAGED provider key from the admin console. Values are encrypted at
// rest by setKey; this route never returns a raw key. Only allowlisted provider keys are accepted
// (isManagedKey) - bootstrap secrets can never be set here. Every change is audited.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { name?: string; value?: string; action?: string };
  try {
    body = (await request.json()) as { name?: string; value?: string; action?: string };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const name = String(body.name ?? "");
  if (!isManagedKey(name)) return NextResponse.json({ error: "Not a manageable key" }, { status: 400 });

  if (body.action === "delete") {
    await deleteKey(name);
    await recordAudit({ action: "credential.rotate", actorId: user.id, targetType: "provider_key", targetId: name, result: "ok", reason: "key removed (revert to env)" });
    return NextResponse.json({ ok: true });
  }

  const value = String(body.value ?? "").trim();
  if (!value) return NextResponse.json({ error: "Value required" }, { status: 400 });
  await setKey(name, value, user.id);
  await recordAudit({ action: "credential.rotate", actorId: user.id, targetType: "provider_key", targetId: name, result: "ok", reason: "key set/rotated from admin" });
  return NextResponse.json({ ok: true });
}
