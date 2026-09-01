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
  // GPT-Image (OpenAI) is the DEFAULT image model (switched 2026-09-01): used when explicitly chosen OR when
  // IMAGE_PROVIDER is unset and an OpenAI key is present - so real ad visuals are ON without needing an env
  // var. Lazily imported so its server-only module never loads on a stub/dev path. Set IMAGE_PROVIDER=google
  // to force Nano Banana, or IMAGE_PROVIDER=stub to force placeholders.
  const wantsOpenai = choice === "openai" || (choice === "" && !!process.env.OPENAI_API_KEY);
  if (wantsOpenai && process.env.OPENAI_API_KEY) {
    const { openaiImageProvider } = await import("./openai-image");
    return openaiImageProvider;
  }
  // Google images (Nano Banana) when explicitly chosen, or the fallback default when no OpenAI key but a
  // Gemini key is present. Safe: a failed generation degrades to a flagged placeholder in the pipeline (never
  // a crash), and the provider itself falls back from the preview model id to the stable one.
  const wantsGoogle = choice === "google" || (choice === "" && !!process.env.GEMINI_API_KEY);
  if (wantsGoogle && process.env.GEMINI_API_KEY) {
    const { googleImageProvider } = await import("./google-gemini");
    return googleImageProvider;
  }
  return stubImageProvider; // no key / IMAGE_PROVIDER=stub -> deterministic placeholder, keeps the pipeline alive
}

// True when a REAL image provider would run (not the 1x1 placeholder stub). The generate route uses this to
// refuse honestly - never charge tokens for a stub placeholder - unless demo paths are explicitly opted in.
// Mirrors the selection logic in getImageProvider() exactly.
export function isRealImageProviderConfigured(): boolean {
  const choice = (process.env.IMAGE_PROVIDER ?? "").toLowerCase();
  if (choice === "stub") return false;
  const wantsOpenai = choice === "openai" || (choice === "" && !!process.env.OPENAI_API_KEY);
  if (wantsOpenai && process.env.OPENAI_API_KEY) return true;
  const wantsGoogle = choice === "google" || (choice === "" && !!process.env.GEMINI_API_KEY);
  if (wantsGoogle && process.env.GEMINI_API_KEY) return true;
  return false;
}
