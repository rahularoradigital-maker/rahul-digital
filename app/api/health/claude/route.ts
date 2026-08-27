import { NextResponse } from "next/server";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";

/** GET /api/health/claude -> proves the Claude API is reachable from the server. */
export async function GET() {
  // Auth-gate this: it makes a PAID Anthropic call, so an unauthenticated endpoint is a
  // financial-DoS vector (anyone could loop it to burn tokens).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const anthropic = getAnthropic();
    const msg = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 32,
      messages: [{ role: "user", content: "Reply with exactly: pong" }],
    });
    const reply = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    return NextResponse.json({ ok: true, model: CLAUDE_MODEL, reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
