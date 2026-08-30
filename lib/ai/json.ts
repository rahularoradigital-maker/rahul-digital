// Shared JSON helpers for the non-Gemini adapters. Gemini has native structured output; OpenAI and
// Anthropic here get a JSON instruction appended and the reply parsed, matching how the app already
// coaxes JSON out of the Gemini text model (see lib/creative-production/intelligence/llm-json.ts).

export function schemaKeys(schema: Record<string, unknown>): string[] {
  const props = (schema as { properties?: Record<string, unknown> }).properties;
  return props ? Object.keys(props) : [];
}

export function jsonPrompt(prompt: string, schema: Record<string, unknown>): string {
  const keys = schemaKeys(schema);
  const shape = keys.length ? ` The JSON object has these keys: ${keys.join(", ")}.` : "";
  return `${prompt}\n\nRespond with ONLY valid minified JSON.${shape} No markdown, no code fences, no prose.`;
}

export function parseJson(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  let t = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}
