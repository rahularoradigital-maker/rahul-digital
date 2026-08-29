import "server-only";
import { callGeminiText } from "@/lib/gemini";

// Ask the working free-tier text model (gemini-flash-lite-latest via callGeminiText) for strict JSON and
// parse it robustly. Used by Product DNA / Brand DNA / concept generation. Returns null on any failure so
// callers degrade gracefully. Grounding (never invent) is enforced by the caller's prompt.
export async function deriveJSON<T>(prompt: string): Promise<T | null> {
  const out = await callGeminiText(`${prompt}\n\nRespond with ONLY valid minified JSON that matches the requested shape. No markdown, no code fences, no prose.`);
  if (!out) return null;
  const cleaned = out.trim().replace(/^```(?:json)?/i, "").replace(/```$/,"").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/[[{][\s\S]*[\]}]/); // first JSON object/array block
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
