// AI task taxonomy + routing types. The router maps each TaskKind to a model, per the plan
// docs/plans/ai-model-routing.md: light model for light tasks, best model for high-end tasks.
// Deterministic work (influencer scoring, rules engine) is intentionally NOT a TaskKind.

export type Provider = "gemini" | "openai" | "anthropic";
export type Tier = "light" | "standard" | "heavy" | "vision";

export type TaskKind =
  | "ask" // grounded Q&A over the user's data (high volume, light)
  | "analyze-text" // explain/summarize a creative (light)
  | "positioning" // ICP + content pillars (standard)
  | "concept-gen" // creative concepts/hooks (HEAVY - quality is the product)
  | "creative-vision" // multimodal scoring of many creatives (vision, volume)
  | "brand-profile" // brand + competitor extraction from a creative (vision)
  | "decision-verdict"; // the scale/refresh/kill call (HEAVY - high stakes)

export type InlineImage = { data: string; mimeType: string };
export type ModelRef = { provider: Provider; model: string };
export type TaskRoute = { tier: Tier; kind: "text" | "json"; primary: ModelRef; fallbacks: ModelRef[] };
