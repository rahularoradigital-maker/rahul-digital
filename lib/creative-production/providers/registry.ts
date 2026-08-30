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
  if (choice === "google" && process.env.GEMINI_API_KEY) {
    const { googleImageProvider } = await import("./google-gemini");
    return googleImageProvider;
  }
  // GPT-Image (the matrix's image fallback). Lazily imported so its server-only module never loads on a
  // stub/dev path. Selected only when explicitly chosen AND the key is present.
  if (choice === "openai" && process.env.OPENAI_API_KEY) {
    const { openaiImageProvider } = await import("./openai-image");
    return openaiImageProvider;
  }
  return stubImageProvider; // default / no key -> deterministic placeholder, keeps the pipeline alive
}
