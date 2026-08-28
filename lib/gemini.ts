// Gemini primitive: the single low-level call every creative agent shares (stage 7). Fetch
// a still once, inline it, and run a focused prompt with a narrow JSON schema. SERVER-ONLY
// (reads GEMINI_API_KEY). It does not decide WHAT to analyze - each small agent owns one
// task and its own schema; this only carries the request. Returns null on any failure so an
// agent can fail alone without taking down the orchestration.

const MODEL = "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
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
    const res = await fetch(url);
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
      const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyJson,
      });
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
    } catch {
      if (attempt === 0) {
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
    // gemini-3.6-flash is a THINKING model that spends output budget on internal reasoning first, so
    // a low cap truncated the real answer mid-sentence. It does NOT allow disabling thinking, so give
    // a generous cap instead - enough for the reasoning AND a full answer.
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
  });
  // Cap each attempt so a slow free-tier response can NEVER hang past the serverless limit (which
  // shows the user a hard "Ask failed" instead of a graceful message). On abort/timeout we return
  // null and the caller says "could not form an answer, try again".
  const TIMEOUT_MS = 20_000; // a thinking model with a 4096 cap can take a while; one long try beats two short ones
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
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
        return null;
      }
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      return text?.trim() ?? null;
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
