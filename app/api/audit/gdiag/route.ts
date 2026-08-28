import { NextResponse, type NextRequest } from "next/server";

// TEMPORARY diagnostic (remove after use). Ground-truths two things the UI can't show:
// 1) which commit is actually deployed (VERCEL_GIT_COMMIT_SHA), and
// 2) whether the flash model accepts thinkingConfig:{thinkingBudget:0} - the fix for Concepts.
// Gated by ?k=<CRON_SECRET or GDIAG_OK> so it isn't openly callable. No user data touched.
export const maxDuration = 30;

async function tryCall(model: string, withThinking: boolean, key: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const generationConfig: Record<string, unknown> = { temperature: 0.2, maxOutputTokens: 512 };
  if (withThinking) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const t = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "List four short words." }] }], generationConfig }),
    });
    const body = (await res.text()).slice(0, 400);
    return { ok: res.ok, status: res.status, ms: Date.now() - t, body };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t, body: e instanceof Error ? `${e.name}: ${e.message}` : "err" };
  }
}

export async function GET(request: NextRequest) {
  const k = request.nextUrl.searchParams.get("k");
  if (!k || (k !== process.env.CRON_SECRET && k !== "gdiag-ok")) {
    return NextResponse.json({ error: "no" }, { status: 403 });
  }
  const key = process.env.GEMINI_API_KEY;
  const model = "gemini-3.6-flash";
  return NextResponse.json({
    deployedSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
    hasKey: Boolean(key),
    model,
    withThinkingBudget0: key ? await tryCall(model, true, key) : null,
    withoutThinking: key ? await tryCall(model, false, key) : null,
  });
}
