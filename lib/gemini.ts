// Gemini primitive: the single low-level call every creative agent shares (stage 7). Fetch
// a still once, inline it, and run a focused prompt with a narrow JSON schema. SERVER-ONLY
// (reads GEMINI_API_KEY). It does not decide WHAT to analyze - each small agent owns one
// task and its own schema; this only carries the request. Returns null on any failure so an
// agent can fail alone without taking down the orchestration.

import { fetchWithTimeout } from "./http.ts";

const MODEL = "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
// Text tasks (Ask, Brand Brain, Concepts) run on a DIFFERENT model from the vision pipeline above so
// they draw on a SEPARATE free-tier quota bucket: the 75-call/run vision pipeline exhausts
// gemini-3.6-flash's daily quota (verified live: 429 "exceeded your quota"), which was starving these
// low-volume user-facing calls (Concepts failed with "the model was slow"). gemini-flash-latest has its
// own quota and returns reliably (verified live: 200 in ~3s warm). gemini-2.0/2.5-flash are 404 for this
// project. When the pipeline moves to fingerprint-once (10x fewer calls) or a paid tier, revisit.
const TEXT_MODEL = "gemini-flash-latest";
const TEXT_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent`;
const MAX_IMAGE_BYTES = 8_000_000; // skip inlining a still larger than this; run copy-only

export const GEMINI_MODEL = MODEL;

export type InlineImage = { data: string; mimeType: string };

// A minimal JSON schema: an object whose named keys are all strings. Every agent's schema
// is this shape (a handful of nullable-string attributes), so agents stay small and uniform.
// Gemini's REST responseSchema requires the OpenAPI enum TYPES IN UPPERCASE (OBJECT/STRING);
// lowercase is rejected with a 400, which is why the first cut analyzed 0 creatives.
export function stringObjectSchema(keys: string[]): Record<string, unknown> {
  return { type: "OBJECT", properties: Object.fromEntries(keys.map((k) => [k, { type: "STRING" }])) };
}

// One tiny diagnostic call so a failing run can report WHY (status + body snippet) instead
// of a silent "0 analyzed". Text-only; no schema. Never throws.
export async function probeGemini(): Promise<{ ok: boolean; status: number; body: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, status: 0, body: "GEMINI_API_KEY not set" };
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with the word ok." }] }] }),
    });
    const body = (await res.text()).slice(0, 300);
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : "probe failed" };
  }
}

// Fetch a still image and return base64 + mime, or null (missing / too large / not an image /
// network error). Done once by the orchestrator and shared across all vision agents so a
// creative is downloaded a single time, not once per agent.
export async function fetchInlineImage(url: string | null | undefined): Promise<InlineImage | null> {
  if (!url) return null;
  try {
    const res = await fetchWithTimeout(url, {}, 10_000);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    if (!mimeType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) return null;
    return { data: buf.toString("base64"), mimeType };
  } catch {
    return null;
  }
}

/**
 * Run one focused prompt against Gemini with structured JSON output. `inline` is passed only
 * by agents that need to see the creative. Throws only when the key is missing (a config
 * error worth surfacing); every other failure returns null so one agent's miss is isolated.
 */
export async function callGemini(
  prompt: string,
  schema: Record<string, unknown>,
  inline?: InlineImage | null,
): Promise<Record<string, unknown> | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const parts: Record<string, unknown>[] = [{ text: prompt }];
  if (inline) parts.push({ inline_data: { mime_type: inline.mimeType, data: inline.data } });
  const bodyJson = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
  });

  // One retry with a short backoff on the transient rate-limit / overload statuses (429/503),
  // which is what makes many creatives fail on a burst; a hard error (400/404) is not retried.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `${ENDPOINT}?key=${encodeURIComponent(key)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: bodyJson },
        20_000,
      );
      if (!res.ok) {
        if ((res.status === 429 || res.status === 503) && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        return null;
      }
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      return JSON.parse(text) as Record<string, unknown>;
    } catch (e) {
      // Retry a transient blip once, but NOT a timeout abort - retrying would double the wait and can
      // push the run past the serverless limit. A timed-out creative fails alone to null.
      if (attempt === 0 && !(e instanceof Error && e.name === "AbortError")) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      return null;
    }
  }
  return null;
}

/**
 * Text-only variant of callGemini: a plain prompt in, a plain string out (no JSON schema). Used by
 * Ask AdBrain to answer a question in prose. Same 429/503 retry. Returns null on any failure so the
 * caller degrades gracefully; throws only when the key is missing (a real config error).
 */
export async function callGeminiText(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const bodyJson = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    // This flash model is a THINKING model and REJECTS thinkingConfig:{thinkingBudget:0} with a hard
    // 400 (verified live) - so we can't turn thinking off. The real Concepts failure was simply the
    // old 15s cap being too tight for a longer generation (thinking + 4 recipes). 8192 tokens is proven
    // enough for the answer; the fix is a longer timeout, below.
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
  });
  // Cap each attempt so a slow free-tier response can NEVER hang past the serverless limit (which
  // shows the user a hard failure instead of a graceful message). On abort/timeout we return null and
  // the caller says "could not generate, try again". 25s fits the routes' maxDuration=30 with margin.
  const TIMEOUT_MS = 25_000;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${TEXT_ENDPOINT}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyJson,
        signal: controller.signal,
      });
      if (!res.ok) {
        if ((res.status === 429 || res.status === 503) && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        const body = await res.text().catch(() => "");
        console.error(`[gemini] text ${res.status}: ${body.slice(0, 300)}`); // diagnostics -> server logs, not the UI
        return null;
      }
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.error(`[gemini] text empty, finishReason=${json.candidates?.[0]?.finishReason ?? "?"}`);
        return null;
      }
      return text.trim();
    } catch (e) {
      // Retry a transient network blip once, but NOT a timeout abort (retrying would double the wait
      // and risk the 30s serverless limit). A timed-out call fails gracefully to null.
      if (attempt === 0 && !(e instanceof Error && e.name === "AbortError")) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
