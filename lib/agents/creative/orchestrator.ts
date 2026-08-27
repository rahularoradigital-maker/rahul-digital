// The orchestration layer for stage 7. It coordinates the small creative agents: fetch the
// creative once, run every specialist agent in PARALLEL, merge their slices, then run the
// dependent agent(s) with that merged context so they reason over the specialists' findings.
// No single agent owns the whole result - each contributes its slice, and one agent failing
// only blanks its own fields. Pure merge/normalize helpers are exported for testing without
// any network call.

import { fetchInlineImage } from "../../gemini.ts";
import { SPECIALIST_AGENTS, DEPENDENT_AGENTS, type AgentCtx } from "./agents.ts";
import type { CreativeAttributes } from "../../competitors/types.ts";

export type CreativeMedia = {
  imageUrl: string | null;
  videoThumbUrl: string | null;
  title: string | null;
  body: string | null;
  ctaText: string | null;
  isVideo: boolean;
};

const ALL_KEYS: (keyof CreativeAttributes)[] = [
  "funnelStage", "hook", "hookType", "firstThreeSeconds", "messaging", "offer", "cta", "productVsHuman",
  "creatorTraits", "voiceAudio", "visualScene", "colorTypography", "branding", "painPoint", "benefit",
  "primaryEmotion", "socialProof", "storytelling", "editingPacing", "closing", "conversionIntent", "notes",
];

function isFilled(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.trim().toLowerCase() !== "none";
}

// Merge agent slices into one attribute set: the first non-empty value for each key wins, so
// each agent only ever fills its own fields and a later agent cannot clobber a good answer.
// Pure - no I/O. Exported for the check.
export function mergeAttributes(partials: Partial<CreativeAttributes>[]): CreativeAttributes {
  const out = Object.fromEntries(ALL_KEYS.map((k) => [k, null])) as CreativeAttributes;
  for (const p of partials) {
    for (const k of ALL_KEYS) {
      if (out[k] === null && isFilled(p[k])) {
        if (k === "funnelStage") {
          const s = String(p[k]).toUpperCase();
          out.funnelStage = s === "TOF" || s === "MOF" || s === "BOF" ? s : null;
        } else {
          out[k] = String(p[k]).trim() as never;
        }
      }
    }
  }
  return out;
}

// Did any agent produce anything? If not, the creative could not be analyzed at all.
export function anyFilled(attrs: CreativeAttributes): boolean {
  return ALL_KEYS.some((k) => attrs[k] !== null);
}

function buildCopy(media: CreativeMedia): string {
  return [
    media.title ? `Headline: ${media.title}` : "",
    media.body ? `Body: ${media.body}` : "",
    media.ctaText ? `CTA button: ${media.ctaText}` : "",
  ]
    .filter(Boolean)
    .join("\n") || "(no copy)";
}

/**
 * Orchestrate the creative agents for one ad. Returns the merged 42-attribute set, or null
 * if every agent failed (so the caller skips this ad rather than storing an empty read).
 */
export async function analyzeCreative(media: CreativeMedia): Promise<CreativeAttributes | null> {
  const inline = await fetchInlineImage(media.imageUrl ?? media.videoThumbUrl);
  const baseCtx: AgentCtx = { copyText: buildCopy(media), inline, isVideo: media.isVideo, upstream: {} };

  // Tier 1: independent specialists, in parallel. Each isolated: a throw becomes {}.
  const specialistSlices = await Promise.all(SPECIALIST_AGENTS.map((a) => a.run(baseCtx).catch(() => ({}))));
  let merged = mergeAttributes(specialistSlices);

  // Tier 2: dependent agents reason over the specialists' merged findings (data hand-off).
  const depCtx: AgentCtx = { ...baseCtx, upstream: merged };
  const dependentSlices = await Promise.all(DEPENDENT_AGENTS.map((a) => a.run(depCtx).catch(() => ({}))));
  merged = mergeAttributes([merged, ...dependentSlices]);

  return anyFilled(merged) ? merged : null;
}
