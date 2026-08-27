// Gemini primitive: the single low-level call every creative agent shares (stage 7). Fetch
// a still once, inline it, and run a focused prompt with a narrow JSON schema. SERVER-ONLY
// (reads GEMINI_API_KEY). It does not decide WHAT to analyze - each small agent owns one
// task and its own schema; this only carries the request. Returns null on any failure so an
// agent can fail alone without taking down the orchestration.

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_IMAGE_BYTES = 8_000_000; // skip inlining a still larger than this; run copy-only

export const GEMINI_MODEL = MODEL;

export type InlineImage = { data: string; mimeType: string };

// A minimal JSON schema: an object whose named keys are all strings. Every agent's schema
// is this shape (a handful of nullable-string attributes), so agents stay small and uniform.
export function stringObjectSchema(keys: string[]): Record<string, unknown> {
  return { type: "object", properties: Object.fromEntries(keys.map((k) => [k, { type: "string" }])) };
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

  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
