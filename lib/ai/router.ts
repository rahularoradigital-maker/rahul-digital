// The router: every AI task in the app goes through here. It picks the configured model for the task
// and, on a null/failed reply, walks the fallback chain (e.g. Gemini rate-limits -> Claude/OpenAI).
// Two modes match the app's two existing shapes: text (raw string) and json (parsed object + optional
// image). Deterministic work (influencer scoring, rules) must NOT call this - it stays pure.

import { ROUTES } from "./config.ts";
import type { InlineImage, ModelRef, TaskKind } from "./tasks.ts";
import { gemini } from "./providers/gemini.ts";
import { openai } from "./providers/openai.ts";
import { anthropic } from "./providers/anthropic.ts";

const ADAPTERS = { gemini, openai, anthropic };

function chain(kind: TaskKind): ModelRef[] {
  const r = ROUTES[kind];
  return [r.primary, ...r.fallbacks];
}

/** Text task: returns the raw model text (caller parses if needed), or null after all fallbacks. */
export async function runTaskText(kind: TaskKind, prompt: string): Promise<string | null> {
  for (const m of chain(kind)) {
    const out = await ADAPTERS[m.provider].text(m.model, prompt);
    if (out != null) return out;
    if (process.env.ADBRAIN_PERF) console.warn(`[ai] ${kind}: ${m.provider}/${m.model} returned null, trying next`);
  }
  return null;
}

/** JSON task: returns a parsed object, or null after all fallbacks. `inline` = optional creative image. */
export async function runTaskJson(
  kind: TaskKind,
  prompt: string,
  schema: Record<string, unknown>,
  inline?: InlineImage | null,
): Promise<Record<string, unknown> | null> {
  for (const m of chain(kind)) {
    const out = await ADAPTERS[m.provider].json(m.model, prompt, schema, inline ?? null);
    if (out != null) return out;
    if (process.env.ADBRAIN_PERF) console.warn(`[ai] ${kind}: ${m.provider}/${m.model} returned null, trying next`);
  }
  return null;
}
