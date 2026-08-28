import { NextResponse, type NextRequest } from "next/server";

// TEMPORARY diagnostic (remove after use). Lite models have higher free quotas + are faster; test
// whether one reliably serves the long Concepts prompt. Gated by ?k=. No user data.
export const maxDuration = 60;

const LONG =
  "You are a creative strategist. Propose exactly 4 NEW creatives to test for a D2C ethnic-wear brand, " +
  "each as a recipe with five named parts on their own lines: SKU, Format, Concept, Offer, Landing - then one line 'Why'. " +
  "Number them 1 to 4. Plain Indian English, rupees, no hype words, no em dashes.";

async function run(model: string, key: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const t = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: LONG }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 8192 } }),
    });
    const raw = await res.text();
    let finishReason = "?", textLen = 0;
    try {
      const j = JSON.parse(raw) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
      finishReason = j.candidates?.[0]?.finishReason ?? "?";
      textLen = (j.candidates?.[0]?.content?.parts?.[0]?.text ?? "").length;
    } catch { /* non-JSON */ }
    return { model, status: res.status, ms: Date.now() - t, finishReason, textLen, bodyHead: raw.slice(0, 90) };
  } catch (e) {
    return { model, status: 0, ms: Date.now() - t, finishReason: "throw", textLen: 0, bodyHead: e instanceof Error ? `${e.name}: ${e.message}` : "err" };
  }
}

export async function GET(request: NextRequest) {
  const k = request.nextUrl.searchParams.get("k");
  if (!k || (k !== process.env.CRON_SECRET && k !== "gdiag-ok")) return NextResponse.json({ error: "no" }, { status: 403 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "no key" });
  const out: Record<string, unknown> = { deployedSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown" };
  for (const m of ["gemini-flash-lite-latest", "gemini-2.5-flash-lite-latest", "gemini-flash-latest"]) {
    out[m] = await run(m, key);
  }
  return NextResponse.json(out);
}
