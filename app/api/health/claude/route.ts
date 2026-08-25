import { NextResponse } from "next/server";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";

/** GET /api/health/claude -> proves the Claude API is reachable from the server. */
export async function GET() {
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
