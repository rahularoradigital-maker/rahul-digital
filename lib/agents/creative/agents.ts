// The small, single-purpose creative agents (stage 7). Each agent owns ONE narrow slice of
// the 22-attribute set, has its own focused instruction + schema, and reads only what it
// needs. No agent depends on another except the funnel classifier, which consumes the
// upstream agents' findings (that data hand-off is the point of the orchestration layer).
// One agent failing returns {} for its slice - the rest still produce their fields.

import { callGemini, stringObjectSchema, type InlineImage } from "../../gemini.ts";
import type { CreativeAttributes } from "../../competitors/types.ts";

export type AgentCtx = {
  copyText: string; // headline / body / CTA, pre-formatted
  inline: InlineImage | null; // the creative still, shared (fetched once)
  isVideo: boolean;
  upstream: Partial<CreativeAttributes>; // findings from earlier agents (for dependent agents)
};

export type CreativeAgent = {
  name: string;
  tier: "specialist" | "dependent"; // specialists run in parallel; dependents run after, with upstream
  run: (ctx: AgentCtx) => Promise<Partial<CreativeAttributes>>;
};

const BASE =
  "You are a senior performance-creative analyst reading ONE real Facebook ad. Use only what you actually see in the image and read in the copy. Answer each field in a short phrase; if an attribute is genuinely absent, use 'none'. Never invent facts.";

// Keep only the schema keys, so an agent can never write outside its own slice.
function pick(out: Record<string, unknown> | null, keys: (keyof CreativeAttributes)[]): Partial<CreativeAttributes> {
  if (!out) return {};
  const r: Partial<CreativeAttributes> = {};
  for (const k of keys) {
    const v = out[k as string];
    if (typeof v === "string") r[k] = v as never;
  }
  return r;
}

type AgentSpec = {
  name: string;
  tier: "specialist" | "dependent";
  keys: (keyof CreativeAttributes)[];
  needsVision: boolean;
  usesUpstream?: boolean;
  instruction: string;
};

function makeAgent(spec: AgentSpec): CreativeAgent {
  const schema = stringObjectSchema(spec.keys as string[]);
  return {
    name: spec.name,
    tier: spec.tier,
    async run(ctx: AgentCtx): Promise<Partial<CreativeAttributes>> {
      const upstream = spec.usesUpstream ? `\n\nWhat other analysts already found on this ad:\n${JSON.stringify(ctx.upstream)}` : "";
      const videoNote = ctx.isVideo ? "\n(This is a VIDEO ad; the image is its preview frame.)" : "";
      const prompt = `${BASE}\n\nYour job: ${spec.instruction}${videoNote}\n\nAd copy:\n${ctx.copyText}${upstream}`;
      const out = await callGemini(prompt, schema, spec.needsVision ? ctx.inline : null);
      return pick(out, spec.keys);
    },
  };
}

// --- Specialist agents (independent; run in parallel) ---

export const hookAgent = makeAgent({
  name: "hook",
  tier: "specialist",
  needsVision: true,
  keys: ["hook", "hookType", "firstThreeSeconds"],
  instruction:
    "identify the opening hook (the first thing that grabs attention), classify its hookType (e.g. Question, Bold claim, Problem, Stat, Curiosity, Discount, Testimonial), and describe the first-three-seconds equivalent (the first frame / first line).",
});

export const messageAgent = makeAgent({
  name: "message",
  tier: "specialist",
  needsVision: true,
  keys: ["messaging", "painPoint", "benefit", "primaryEmotion", "storytelling"],
  instruction:
    "extract the core messaging angle, the painPoint it targets, the main benefit promised, the primaryEmotion it plays on (one word), and the storytelling approach.",
});

export const offerAgent = makeAgent({
  name: "offer",
  tier: "specialist",
  needsVision: true,
  keys: ["offer", "cta", "conversionIntent"],
  instruction:
    "identify the offer (discount, bundle, free trial, none), the CTA it drives to, and how strong the conversionIntent is (soft / medium / hard).",
});

export const visualAgent = makeAgent({
  name: "visual",
  tier: "specialist",
  needsVision: true,
  keys: ["visualScene", "colorTypography", "branding", "productVsHuman", "editingPacing", "closing"],
  instruction:
    "describe the visualScene, the colorTypography style, how prominent the branding is, whether it is product-led or human/creator-led (productVsHuman), the editingPacing feel, and how it closes.",
});

export const creatorAgent = makeAgent({
  name: "creator",
  tier: "specialist",
  needsVision: true,
  keys: ["creatorTraits", "voiceAudio", "socialProof"],
  instruction:
    "if a person/creator features, describe their creatorTraits; describe any voice/audio cue implied; and note any socialProof (reviews, ratings, UGC, endorsements).",
});

// --- Dependent agent (runs after specialists; consumes their findings) ---

export const funnelAgent = makeAgent({
  name: "funnel",
  tier: "dependent",
  needsVision: false,
  usesUpstream: true,
  keys: ["funnelStage", "notes"],
  instruction:
    "using the ad copy AND the other analysts' findings, classify the funnelStage as exactly TOF (awareness/top), MOF (consideration/middle), or BOF (conversion/bottom), and add one short note explaining the call.",
});

export const SPECIALIST_AGENTS: CreativeAgent[] = [hookAgent, messageAgent, offerAgent, visualAgent, creatorAgent];
export const DEPENDENT_AGENTS: CreativeAgent[] = [funnelAgent];
