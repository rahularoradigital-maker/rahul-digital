// OpenAI adapter (Chat Completions). Server-only (reads OPENAI_API_KEY). Returns null on any
// failure so the router can fall back, matching lib/gemini.ts's failure-isolation contract.
// Model IDs come from config (env-overridable) - confirm current IDs at platform.openai.com/docs.

import type { InlineImage } from "../tasks.ts";
import { jsonPrompt, parseJson } from "../json.ts";
import { recordSpend } from "../spend.ts";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

async function call(model: string, prompt: string, inline: InlineImage | null, json: boolean): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const parts: Record<string, unknown>[] = [{ type: "text", text: prompt }];
  if (inline) parts.push({ type: "image_url", image_url: { url: `data:${inline.mimeType};base64,${inline.data}` } });
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: inline ? parts : prompt }],
    temperature: 0.2,
  };
  if (json) body.response_format = { type: "json_object" };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[openai] ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      return null;
    }
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const text = j.choices?.[0]?.message?.content?.trim() ?? null;
    if (text != null) recordSpend({ provider: "openai", model, promptTokens: j.usage?.prompt_tokens ?? 0, completionTokens: j.usage?.completion_tokens ?? 0 });
    return text;
  } catch (e) {
    console.error("[openai] " + (e instanceof Error ? e.message : "request failed"));
    return null;
  }
}

export const openai = {
  text: (model: string, prompt: string): Promise<string | null> => call(model, prompt, null, false),
  json: (model: string, prompt: string, schema: Record<string, unknown>, inline: InlineImage | null) =>
    call(model, jsonPrompt(prompt, schema), inline, true).then(parseJson),
};
