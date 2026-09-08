import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit-distributed";
import { setAiUser } from "@/lib/ai/context";
import { interpretIntent } from "@/lib/operations/interpret";
import { loadAdvertisingMemory } from "@/lib/operations/memory";
import { dispatch } from "@/lib/operations/dispatch";
import { getUserMetaSession } from "@/lib/meta-sync";

// The Track-A spine so far, end to end and READ-ONLY: intent -> typed operation (A1) -> relevant rules/memory
// (A2) -> dispatch to the right existing tool + real read (A3). It plans; it does not validate params (A4),
// ask for approval (A5), or execute anything. Auth-gated + rate-limited.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const rl = await enforceRateLimit(`plan:${user.id}`, { windowMs: 60_000, max: 20 });
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

  const operation = await interpretIntent(text, "ask");
  const session = await getUserMetaSession(user.id);
  const memory = await loadAdvertisingMemory(user.id, session?.activeExternalId ?? "*", operation);
  // Only dispatch when the operation is well-formed; a needs_clarification op waits for the user's answer.
  const dispatchResult = operation.status === "needs_clarification" ? null : await dispatch(operation, user.id);
  return NextResponse.json({ operation, memory, dispatch: dispatchResult });
}
