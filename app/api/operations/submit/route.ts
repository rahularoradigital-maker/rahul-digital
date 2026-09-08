import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit-distributed";
import { setAiUser } from "@/lib/ai/context";
import { interpretIntent } from "@/lib/operations/interpret";
import { loadAdvertisingMemory } from "@/lib/operations/memory";
import { dispatch } from "@/lib/operations/dispatch";
import { validateOperation } from "@/lib/operations/validate";
import { createPending } from "@/lib/operations/pending-store";
import { getUserMetaSession } from "@/lib/meta-sync";

// A5: run the full read-only spine (interpret -> memory -> dispatch -> validate) and, for a real actionable
// operation, PERSIST it to the approval queue as a pending row (validated -> ready_for_approval, blocked ->
// blocked so the user sees why). Still executes NOTHING - it only queues a proposal for human review.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const rl = await enforceRateLimit(`submit:${user.id}`, { windowMs: 60_000, max: 20 });
  if (rl.limited) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  const denied = await guardProductApi();
  if (denied) return denied;
  setAiUser(user.id);
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Interpreter not configured (GEMINI_API_KEY missing)." }, { status: 400 });

  let text = "";
  try {
    text = String(((await request.json()) as { text?: string }).text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "Provide a request." }, { status: 400 });

  // async-parallel: interpret (Gemini) and the session read (DB) are independent - run them together.
  const [operation, session] = await Promise.all([interpretIntent(text, "ask"), getUserMetaSession(user.id)]);
  const account = session?.activeExternalId ?? "*";
  const memory = await loadAdvertisingMemory(user.id, account, operation);

  if (operation.status === "needs_clarification") {
    return NextResponse.json({ operation, memory, pending: null, note: "Need one detail before this can be queued." });
  }
  const dispatchResult = await dispatch(operation, user.id);
  if (dispatchResult.status !== "ready") {
    return NextResponse.json({ operation, memory, dispatch: dispatchResult, pending: null, note: "Nothing to queue: not connected, target not found, or a read." });
  }
  const validation = validateOperation(operation, memory.rules, {
    roas: dispatchResult.target?.roas,
    verdict: dispatchResult.read?.verdict as string | undefined,
    name: dispatchResult.target?.name,
    campaignName: dispatchResult.target?.campaignName,
    adsetName: dispatchResult.target?.adsetName,
  });
  // Queue actionable proposals (validated -> ready, blocked -> shown); reads (not_applicable) are not queued.
  const pending = await createPending(user.id, account, operation, validation, { target: dispatchResult.target, read: dispatchResult.read });
  return NextResponse.json({ operation, memory, dispatch: dispatchResult, validation, pending });
}
