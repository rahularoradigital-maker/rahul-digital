// The router: every AI task in the app goes through here. It picks the configured model for the task
// and, on a null/failed reply, walks the fallback chain (e.g. Gemini rate-limits -> Claude/OpenAI).
// Two modes match the app's two existing shapes: text (raw string) and json (parsed object + optional
// image). Deterministic work (influencer scoring, rules) must NOT call this - it stays pure.

import { ROUTES } from "./config.ts";
import type { InlineImage, ModelRef, TaskKind } from "./tasks.ts";
import { gemini } from "./providers/gemini.ts";
import { openai } from "./providers/openai.ts";
import { anthropic } from "./providers/anthropic.ts";
import { recordAiCall } from "./usage.ts";
import { setAiTask, currentAiUserId } from "./context.ts";
import { aiBudgetExceeded, tenantAiBudgetExceeded } from "./budget.ts";
import { isKilled } from "../security/flags.ts";

// S4: the per-tenant ceiling. Only meaningful when the request bound a user (setAiUser at the route
// boundary); unattributed background calls (userId null) skip it and remain bounded by the global budget.
async function tenantPaused(): Promise<boolean> {
  const uid = currentAiUserId();
  return uid != null && (await tenantAiBudgetExceeded(uid));
}

const ADAPTERS = { gemini, openai, anthropic };

function chain(kind: TaskKind): ModelRef[] {
  const r = ROUTES[kind];
  return [r.primary, ...r.fallbacks];
}

/** Text task: returns the raw model text (caller parses if needed), or null after all fallbacks. */
export async function runTaskText(kind: TaskKind, prompt: string): Promise<string | null> {
  if (await isKilled("ai")) return null; // global AI kill switch: halt every call at the source (callers already handle null)
  if (await aiBudgetExceeded()) return null; // global daily AI cost ceiling hit -> pause AI for all
  if (await tenantPaused()) return null; // this tenant's own daily ceiling hit -> pause AI for them only (S4)
  setAiTask(kind); // attribute spend to this task
  for (const m of chain(kind)) {
    recordAiCall(); // fire-and-forget cost counter (no-op without Upstash)
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
  if (await isKilled("ai")) return null; // global AI kill switch: halt every call at the source (callers already handle null)
  if (await aiBudgetExceeded()) return null; // global daily AI cost ceiling hit -> pause AI for all
  if (await tenantPaused()) return null; // this tenant's own daily ceiling hit -> pause AI for them only (S4)
  setAiTask(kind); // attribute spend to this task
  for (const m of chain(kind)) {
    recordAiCall(); // fire-and-forget cost counter (no-op without Upstash)
    const out = await ADAPTERS[m.provider].json(m.model, prompt, schema, inline ?? null);
    if (out != null) return out;
    if (process.env.ADBRAIN_PERF) console.warn(`[ai] ${kind}: ${m.provider}/${m.model} returned null, trying next`);
  }
  return null;
}
