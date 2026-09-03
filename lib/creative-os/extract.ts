import "server-only";
import { callGeminiText } from "@/lib/gemini";
import { buildExtractPrompt, parsePatterns, type ExtractInput, type ExtractContext, type PatternDraft } from "@/lib/creative-os/extract-pure";
import { savePatterns } from "@/lib/creative-os/store";

// Phase 2 — the extraction I/O: Gemini call + parse + (optional) persist. Pure prompt/parse live in
// ./extract-pure. Gemini runs through callGeminiText, which is budget + kill-switch gated at the primitive and
// returns null when the gate is closed — in which case we extract nothing rather than fail.

export async function extractPatterns(input: ExtractInput, ctx: ExtractContext): Promise<PatternDraft[]> {
  const raw = await callGeminiText(buildExtractPrompt(input)).catch(() => null);
  return parsePatterns(raw, ctx);
}

// Extract + persist for a user in one call. Returns the drafts and how many landed.
export async function extractAndSave(userId: string, input: ExtractInput, ctx: ExtractContext): Promise<{ drafts: PatternDraft[]; saved: number }> {
  const drafts = await extractPatterns(input, ctx);
  const saved = await savePatterns(userId, drafts);
  return { drafts, saved };
}
