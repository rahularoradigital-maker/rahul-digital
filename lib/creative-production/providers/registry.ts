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
  if (choice === "stub") return stubImageProvider;
  // Nano Banana (Google Gemini image) is the PREFERRED image model (switched 2026-09-05, Rahul): materially
  // better product fidelity + on-pack text than gpt-image-1, which garbled logos ("boAt" -> "toat") and
  // invented artefacts. Used when explicitly chosen OR when IMAGE_PROVIDER is unset and a GEMINI_API_KEY is
  // present. gpt-image-1 stays configured and is the AUTOMATIC cross-provider fallback (see getFallbackImageProvider
  // + pipeline) so this switch can NEVER regress to a flat placeholder if the Gemini key lacks image billing.
  // Lazily imported so a provider's server-only module never loads on a stub/dev path.
  const wantsGoogle = choice === "google" || (choice === "" && !!process.env.GEMINI_API_KEY);
  if (wantsGoogle && process.env.GEMINI_API_KEY) {
    const { googleImageProvider } = await import("./google-gemini");
    return googleImageProvider;
  }
  // GPT-Image (OpenAI) when explicitly chosen, or when no Gemini key is present.
  const wantsOpenai = choice === "openai" || (choice === "" && !!process.env.OPENAI_API_KEY);
  if (wantsOpenai && process.env.OPENAI_API_KEY) {
    const { openaiImageProvider } = await import("./openai-image");
    return openaiImageProvider;
  }
  return stubImageProvider; // no key / IMAGE_PROVIDER=stub -> deterministic placeholder, keeps the pipeline alive
}

// The OTHER real image provider, used by the pipeline for a CROSS-PROVIDER fallback: if the preferred model
// (Nano Banana) fails to return a real image - bad key, no image billing, safety refusal - generation retries
// on this one so a model switch can't regress to a flat placeholder. Returns null when only one (or no) real
// provider is configured, or when IMAGE_PROVIDER pins a single provider. Never returns the same provider as
// `primaryName`. Lazily imported, same as above.
export async function getFallbackImageProvider(primaryName: string): Promise<ImageProvider | null> {
  const choice = (process.env.IMAGE_PROVIDER ?? "").toLowerCase();
  if (choice === "stub" || choice === "openai" || choice === "google") return null; // explicit pin -> no auto fallback
  if (primaryName !== "openai" && process.env.OPENAI_API_KEY) {
    const { openaiImageProvider } = await import("./openai-image");
    return openaiImageProvider;
  }
  if (primaryName !== "google" && process.env.GEMINI_API_KEY) {
    const { googleImageProvider } = await import("./google-gemini");
    return googleImageProvider;
  }
  return null;
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
