import type { GenerationState } from "./types.ts";

// The single source of truth for an asset's honest state, so the DB + UI never call a compositor-only
// fallback an AI ad. Pure - tested in scripts/check-cp-generation-state.ts.
//   no AI visual            -> COMPOSITOR_ONLY (flat fallback; must never be READY as a premium AI ad)
//   AI visual, primary model-> AI_GENERATED
//   AI visual, fallback used-> AI_GENERATED_WITH_FALLBACK
export function deriveGenerationState(hasVisual: boolean, fallbackUsed: boolean | undefined): GenerationState {
  if (!hasVisual) return "COMPOSITOR_ONLY";
  return fallbackUsed ? "AI_GENERATED_WITH_FALLBACK" : "AI_GENERATED";
}
