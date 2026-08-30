// Anthropic (Claude) adapter (Messages API). Server-only (reads ANTHROPIC_API_KEY). Returns null on
// any failure so the router can fall back. Model IDs come from config (env-overridable) - confirm
// current IDs at docs.anthropic.com. Header auth (x-api-key + anthropic-version).

import type { InlineImage } from "../tasks.ts";
import { jsonPrompt, parseJson } from "../json.ts";

const ENDPOINT = "https://api.anthropic.com/v1/messages";

async function call(model: string, prompt: string, inline: InlineImage | null): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const content: Record<string, unknown>[] = [];
  if (inline) content.push({ type: "image", source: { type: "base64", media_type: inline.mimeType, data: inline.data } });
  content.push({ type: "text", text: prompt });
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 4096, temperature: 0.2, messages: [{ role: "user", content }] }),
    });
    if (!res.ok) {
      console.error(`[anthropic] ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      return null;
    }
    const j = (await res.json()) as { content?: { type: string; text?: string }[] };
    return j.content?.find((b) => b.type === "text")?.text?.trim() ?? null;
  } catch (e) {
    console.error("[anthropic] " + (e instanceof Error ? e.message : "request failed"));
    return null;
  }
}

export const anthropic = {
  text: (model: string, prompt: string): Promise<string | null> => call(model, prompt, null),
  json: (model: string, prompt: string, schema: Record<string, unknown>, inline: InlineImage | null) =>
    call(model, jsonPrompt(prompt, schema), inline).then(parseJson),
};
