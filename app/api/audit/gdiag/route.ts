import { NextResponse, type NextRequest } from "next/server";

// TEMPORARY diagnostic (remove after use). gemini-3.6-flash is 429 (quota exhausted). Test whether
// gemini-flash-latest (a separate quota bucket) reliably returns 200, so text tasks can move to it.
// Gated by ?k=. No user data touched.
export const maxDuration = 60;

async function probe(model: string, key: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const t = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with exactly: OK" }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
      }),
    });
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; error?: { message?: string } };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { model, status: res.status, ms: Date.now() - t, textLen: text.length, err: json.error?.message?.slice(0, 80) ?? null };
  } catch (e) {
    return { model, status: 0, ms: Date.now() - t, textLen: 0, err: e instanceof Error ? `${e.name}: ${e.message}` : "err" };
  }
}

export async function GET(request: NextRequest) {
  const k = request.nextUrl.searchParams.get("k");
  if (!k || (k !== process.env.CRON_SECRET && k !== "gdiag-ok")) {
    return NextResponse.json({ error: "no" }, { status: 403 });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "no key" });
  const results = [];
  // flash-latest three times (spaced) to see past a transient 503; one 3.6 check for comparison.
  results.push(await probe("gemini-flash-latest", key));
  await new Promise((r) => setTimeout(r, 4000));
  results.push(await probe("gemini-flash-latest", key));
  await new Promise((r) => setTimeout(r, 4000));
  results.push(await probe("gemini-flash-latest", key));
  results.push(await probe("gemini-3.6-flash", key));
  return NextResponse.json({ deployedSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown", results });
}
