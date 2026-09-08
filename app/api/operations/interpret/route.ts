import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit-distributed";
import { setAiUser } from "@/lib/ai/context";
import { interpretIntent } from "@/lib/operations/interpret";

// Phase A1 surface: interpret a raw request into a typed Operation and RETURN IT. It executes NOTHING and
// writes NOTHING to any platform - it only classifies intent so the spine (A3-A6) can validate + route +
// (later) queue it for human approval. Auth-gated + rate-limited; server-only so no key reaches the browser.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const rl = await enforceRateLimit(`interpret:${user.id}`, { windowMs: 60_000, max: 30 });
  if (rl.limited) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  const denied = await guardProductApi();
  if (denied) return denied;
  setAiUser(user.id); // attribute AI spend to this user
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Interpreter not configured (GEMINI_API_KEY missing)." }, { status: 400 });

  let text = "";
  try {
    text = String(((await request.json()) as { text?: string }).text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "Provide a request to interpret." }, { status: 400 });

  const operation = await interpretIntent(text, "ask");
  return NextResponse.json({ operation });
}
