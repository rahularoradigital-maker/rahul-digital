import { NextResponse, type NextRequest } from "next/server";

// TEMPORARY diagnostic (remove after use). Probes which FREE Gemini models are actually reachable
// and unthrottled RIGHT NOW, so text tasks (Ask/Concepts/Brand) can move to a model with its own
// quota bucket, separate from the 75-call vision pipeline. Gated by ?k=. No user data touched.
export const maxDuration = 30;

const MODELS = [
  "gemini-3.6-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-2.0-flash-lite",
];

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
    return { model, status: res.status, ms: Date.now() - t, textLen: text.length, err: json.error?.message?.slice(0, 90) ?? null };
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
  // Sequential so we don't self-inflict a 429 burst; each model is its own quota bucket.
  const results = [];
  for (const m of MODELS) results.push(await probe(m, key));
  return NextResponse.json({ deployedSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown", results });
}
