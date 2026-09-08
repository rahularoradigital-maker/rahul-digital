import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { listPending, transitionPending } from "@/lib/operations/pending-store";
import { adsManagerUrl } from "@/lib/app/ads-manager-url";
import { recordAudit } from "@/lib/security/audit-log";
import { notify } from "@/lib/notifications/store";
import { proposalSummary } from "@/lib/operations/monitoring";

// A5 review queue API. GET lists the user's pending operations. POST {id, action} approves or rejects one -
// audited, and refused if the state machine or ownership disallows it. Approve is Track A's terminal: it marks
// the op approved and returns an Ads-Manager HAND-OFF link (AdScale still does not execute anything).
export const maxDuration = 20;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;
  return NextResponse.json({ pending: await listPending(user.id) });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;

  let body: { id?: string; action?: string } = {};
  try {
    body = (await request.json()) as { id?: string; action?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const id = String(body.id ?? "");
  const action = String(body.action ?? "");
  if (!id || (action !== "approve" && action !== "reject")) return NextResponse.json({ error: "Provide id and action (approve|reject)." }, { status: 400 });

  const result = await transitionPending(user.id, id, action === "approve" ? "approved" : "rejected");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });

  // Track A hand-off: on approval, give the user the Ads-Manager deep link to make the change themselves.
  // AdScale does not push it (that is Track B, behind this same approval gate).
  let handoffUrl: string | null = null;
  if (action === "approve") {
    const session = await getUserMetaSession(user.id);
    const target = (result.row.dispatch?.target as { id?: string } | undefined) ?? undefined;
    handoffUrl = adsManagerUrl(session?.activeExternalId, target?.id, {});
    // A6: record the OUTBOUND ACTION distinctly (what AdScale did = handed a proposal off, not executed) and
    // notify the user, so the decision is in the audit trail + the notification center - the monitoring loop.
    const summary = proposalSummary(result.row.kind, result.row.validation);
    await recordAudit({ action: "operation.handoff", actorId: user.id, targetType: "pending_operation", targetId: id, result: "ok", reason: `handed off: ${summary}` });
    await notify({ userId: user.id, kind: "operation", status: "success", title: `Approved: ${summary}`, detail: "Open in Ads Manager to apply the change. AdScale does not apply it for you.", action: handoffUrl, dedupeKey: `op:${id}` });
  }
  return NextResponse.json({ pending: result.row, handoffUrl });
}
