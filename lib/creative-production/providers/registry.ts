import "server-only";
import type { ImageProvider } from "@/lib/creative-production/types";
import { stubImageProvider } from "./stub.ts";

// Creative Production — image provider registry (Phase 6). The rest of the app depends ONLY on ImageProvider;
// which concrete provider runs is env-driven (IMAGE_PROVIDER), so the model/provider can change with zero
// code edits. Defaults to the stub when no real image key/billing is configured, so the pipeline never
// hard-fails - it produces a placeholder until IMAGE_PROVIDER=google is set with a billed GEMINI_API_KEY.
// google-gemini is imported lazily so its `server-only` module never loads on a stub/dev path.
export async function getImageProvider(): Promise<ImageProvider> {
  const choice = (process.env.IMAGE_PROVIDER ?? "").toLowerCase();
  // Real Google images (Nano Banana) when explicitly chosen OR by default when a Gemini key is present and
  // no other provider is picked - so real ad visuals are ON without needing an env var. Safe: a failed
  // generation degrades to a flagged placeholder in the pipeline (never a crash), and the provider itself
  // falls back from the preview model id to the stable one. Set IMAGE_PROVIDER=stub to force placeholders.
  const wantsGoogle = choice === "google" || (choice === "" && !!process.env.GEMINI_API_KEY);
  if (wantsGoogle && process.env.GEMINI_API_KEY) {
    const { googleImageProvider } = await import("./google-gemini");
    return googleImageProvider;
  }
  // GPT-Image (the matrix's image fallback). Lazily imported so its server-only module never loads on a
  // stub/dev path. Selected only when explicitly chosen AND the key is present.
  if (choice === "openai" && process.env.OPENAI_API_KEY) {
    const { openaiImageProvider } = await import("./openai-image");
    return openaiImageProvider;
  }
  return stubImageProvider; // no key / IMAGE_PROVIDER=stub -> deterministic placeholder, keeps the pipeline alive
}
