// Creative Production — STUB image provider. Deterministic, no network, no key. Used by the gate check and
// as a safe default when IMAGE_PROVIDER=stub (local dev before real image billing is enabled). Returns a
// fixed 1x1 PNG so the whole pipeline (brief -> generate -> compose -> QA -> store) runs end-to-end without
// a real key; swap IMAGE_PROVIDER=google (Phase 6) when the key + billing are ready. PURE (no server-only).
import type { ImageProvider, GenerationBrief, GenerationResult, ProviderCapabilities } from "@/lib/creative-production/types";
import { estimateCost } from "./pricing.ts";

const ONE_PX_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export const stubImageProvider: ImageProvider = {
  name: "stub",
  getCapabilities(): ProviderCapabilities {
    return { generation: true, editing: true, referenceImages: 4, aspectRatios: ["1:1", "4:5", "9:16", "16:9"], maxResolution: "1K" };
  },
  getCostEstimate(briefs: GenerationBrief[]) {
    return estimateCost(briefs, "stub", "stub");
  },
  async generateCreative(brief: GenerationBrief): Promise<GenerationResult> {
    return { ok: true, imageBase64: ONE_PX_PNG, mimeType: "image/png", provider: "stub", model: "stub", costUsd: 0, promptVersion: brief.promptVersion };
  },
  async editCreative(brief: GenerationBrief): Promise<GenerationResult> {
    return { ok: true, imageBase64: ONE_PX_PNG, mimeType: "image/png", provider: "stub", model: "stub", costUsd: 0, promptVersion: brief.promptVersion };
  },
  async generateVariant(brief: GenerationBrief): Promise<GenerationResult> {
    return { ok: true, imageBase64: ONE_PX_PNG, mimeType: "image/png", provider: "stub", model: "stub", costUsd: 0, promptVersion: brief.promptVersion };
  },
  async getGenerationStatus(): Promise<"done"> {
    return "done";
  },
};
