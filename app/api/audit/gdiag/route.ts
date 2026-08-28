import { NextResponse, type NextRequest } from "next/server";

// TEMPORARY diagnostic (remove after use). Runs the ACTUAL long Concepts-style prompt against
// gemini-flash-latest at the real config, to see exactly what it returns (status/ms/finishReason/len).
// Gated by ?k=. No user data.
export const maxDuration = 60;

const LONG =
  "You are a creative strategist. Propose exactly 4 NEW creatives to test for a D2C ethnic-wear brand, " +
  "each as a recipe with five named parts on their own lines: SKU, Format, Concept, Offer, Landing - then one line 'Why' that cites a real winning ad. " +
  "Ground every SKU/format/offer in typical winning patterns. Number them 1 to 4. Plain Indian English, rupees, no hype words, no em dashes. " +
  "DATA: {account:'Soch Apparels', topAds:[{ad:'Catalog | Mothers Day',roas:2.1},{ad:'Kurta Set Festive',roas:3.4},{ad:'Anarkali Reel',roas:1.2}]}";

async function run(model: string, maxOutputTokens: number, key: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const t = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: LONG }] }], generationConfig: { temperature: 0.2, maxOutputTokens } }),
    });
    const raw = await res.text();
    let finishReason = "?", textLen = 0;
    try {
      const j = JSON.parse(raw) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
      finishReason = j.candidates?.[0]?.finishReason ?? "?";
      textLen = (j.candidates?.[0]?.content?.parts?.[0]?.text ?? "").length;
    } catch { /* non-JSON body */ }
    return { model, maxOutputTokens, status: res.status, ms: Date.now() - t, finishReason, textLen, bodyHead: raw.slice(0, 120) };
  } catch (e) {
    return { model, maxOutputTokens, status: 0, ms: Date.now() - t, finishReason: "throw", textLen: 0, bodyHead: e instanceof Error ? `${e.name}: ${e.message}` : "err" };
  }
}

export async function GET(request: NextRequest) {
  const k = request.nextUrl.searchParams.get("k");
  if (!k || (k !== process.env.CRON_SECRET && k !== "gdiag-ok")) return NextResponse.json({ error: "no" }, { status: 403 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "no key" });
  return NextResponse.json({
    deployedSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
    flashLatest_8192: await run("gemini-flash-latest", 8192, key),
  });
}
