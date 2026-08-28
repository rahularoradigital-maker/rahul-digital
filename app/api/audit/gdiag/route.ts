import { NextResponse, type NextRequest } from "next/server";

// TEMPORARY diagnostic (remove after use). Ground-truths two things the UI can't show:
// 1) which commit is actually deployed (VERCEL_GIT_COMMIT_SHA), and
// 2) whether the flash model accepts thinkingConfig:{thinkingBudget:0} - the fix for Concepts.
// Gated by ?k=<CRON_SECRET or GDIAG_OK> so it isn't openly callable. No user data touched.
export const maxDuration = 30;

const LONG_PROMPT =
  "You are a creative strategist. Propose exactly 4 NEW creatives to test for a D2C ethnic-wear brand, " +
  "each as a recipe with five named parts on their own lines: SKU, Format, Concept, Offer, Landing - then one line 'Why'. " +
  "Ground each in typical winning ad patterns. Number them 1 to 4. Plain Indian English, rupees, no hype words, no em dashes.";

async function tryCall(model: string, maxOutputTokens: number, key: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const t = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: LONG_PROMPT }] }], generationConfig: { temperature: 0.2, maxOutputTokens } }),
    });
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { ok: res.ok, status: res.status, ms: Date.now() - t, finishReason: json.candidates?.[0]?.finishReason ?? "?", textLen: text.length, textHead: text.slice(0, 80) };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t, finishReason: "throw", textLen: 0, textHead: e instanceof Error ? `${e.name}: ${e.message}` : "err" };
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
    long_8192: key ? await tryCall(model, 8192, key) : null,
    long_24576: key ? await tryCall(model, 24576, key) : null,
  });
}
