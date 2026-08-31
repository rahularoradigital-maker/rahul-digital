import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { setArticleStatus } from "@/lib/growth/articles";
import { recordAudit } from "@/lib/security/audit-log";

// Owner-only: one-tap PUBLISH (make public at /blog) or ARCHIVE a Scout-written article draft. Audited.
// This is the human gate on AI-written public content - nothing goes live without this tap.

const VALID = new Set(["published", "archived", "draft"]);

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

  const ok = await setArticleStatus(id, action as "published" | "archived" | "draft");
  if (!ok) return NextResponse.json({ ok: false, error: "Article not found" }, { status: 404 });

  await recordAudit({ action: action === "published" ? "content.publish" : "content.update", actorId: user.id, actorRole: "admin", targetType: "growth_article", targetId: id, after: { status: action }, reason: "Scout article review" });
  return NextResponse.json({ ok: true });
}
