// Task -> model routing. Defaults follow docs/plans/ai-model-routing.md:
//   light + vision -> Gemini (cheapest, best free quota, one key also does image/video)
//   heavy (concept generation, decision verdict) -> Claude (quality), with Gemini/OpenAI fallback.
// Every model is env-overridable so a swap is config-only. Per-task override: AI_PROVIDER_<KIND>,
// AI_MODEL_<KIND> (KIND uppercased, - -> _), e.g. AI_PROVIDER_CONCEPT_GEN=openai.
// NOTE: model IDs below are defaults - confirm the current IDs/prices in each provider's console.

import type { ModelRef, Provider, TaskKind, TaskRoute } from "./tasks.ts";

const E = (name: string, def: string): string => process.env[name] || def;

const GEMINI_TEXT: ModelRef = { provider: "gemini", model: E("AI_MODEL_GEMINI_TEXT", "gemini-flash-lite-latest") };
const GEMINI_VISION: ModelRef = { provider: "gemini", model: E("AI_MODEL_GEMINI_VISION", "gemini-3.6-flash") };
const CLAUDE_LIGHT: ModelRef = { provider: "anthropic", model: E("AI_MODEL_CLAUDE_LIGHT", "claude-haiku-4-5-20251001") };
const CLAUDE_HEAVY: ModelRef = { provider: "anthropic", model: E("AI_MODEL_CLAUDE_HEAVY", "claude-sonnet-5") };
const OPENAI_LIGHT: ModelRef = { provider: "openai", model: E("AI_MODEL_OPENAI_LIGHT", "gpt-4o-mini") };
const OPENAI_HEAVY: ModelRef = { provider: "openai", model: E("AI_MODEL_OPENAI_HEAVY", "gpt-4o") };

const BASE: Record<TaskKind, TaskRoute> = {
  "ask": { tier: "light", kind: "text", primary: GEMINI_TEXT, fallbacks: [CLAUDE_LIGHT, OPENAI_LIGHT] },
  "analyze-text": { tier: "light", kind: "text", primary: GEMINI_TEXT, fallbacks: [CLAUDE_LIGHT] },
  "positioning": { tier: "standard", kind: "text", primary: GEMINI_TEXT, fallbacks: [CLAUDE_HEAVY] },
  "concept-gen": { tier: "heavy", kind: "text", primary: CLAUDE_HEAVY, fallbacks: [GEMINI_TEXT, OPENAI_HEAVY] },
  "creative-vision": { tier: "vision", kind: "json", primary: GEMINI_VISION, fallbacks: [OPENAI_HEAVY] },
  "brand-profile": { tier: "vision", kind: "json", primary: GEMINI_VISION, fallbacks: [CLAUDE_HEAVY] },
  "decision-verdict": { tier: "heavy", kind: "text", primary: CLAUDE_HEAVY, fallbacks: [GEMINI_TEXT, OPENAI_HEAVY] },
};

// Per-task env override of the PRIMARY model, e.g. AI_PROVIDER_ASK=anthropic + AI_MODEL_ASK=claude-...
function withOverrides(kind: TaskKind, route: TaskRoute): TaskRoute {
  const suffix = kind.toUpperCase().replace(/-/g, "_");
  const provider = process.env[`AI_PROVIDER_${suffix}`] as Provider | undefined;
  const model = process.env[`AI_MODEL_${suffix}`];
  if (!provider && !model) return route;
  const primary: ModelRef = { provider: provider ?? route.primary.provider, model: model ?? route.primary.model };
  return { ...route, primary, fallbacks: [route.primary, ...route.fallbacks] };
}

export const ROUTES: Record<TaskKind, TaskRoute> = Object.fromEntries(
  (Object.keys(BASE) as TaskKind[]).map((k) => [k, withOverrides(k, BASE[k])]),
) as Record<TaskKind, TaskRoute>;
