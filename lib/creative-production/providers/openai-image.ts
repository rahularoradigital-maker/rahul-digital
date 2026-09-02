import "server-only";
import { priceFor, estimateCost } from "./pricing.ts";
import type { ImageProvider, GenerationBrief, GenerationResult, ProviderCapabilities, CostEstimate } from "@/lib/creative-production/types";

// OpenAI GPT-Image provider (the matrix's image fallback: Nano Banana -> GPT-Image). Implements the same
// ImageProvider interface as the Google adapter, over OpenAI's Images API (no SDK, fetch + Bearer, matching
// the app's convention). Key is server-only (OPENAI_API_KEY). The AI renders the VISUAL only - deterministic
// composition draws the precise text downstream - so the prompt forbids words. Keyless-graceful: returns an
// error result (never throws) when no key, so the pipeline degrades instead of crashing.

const GEN_URL = "https://api.openai.com/v1/images/generations";
const EDIT_URL = "https://api.openai.com/v1/images/edits";
const IMAGE_TIMEOUT_MS = 90_000; // gpt-image-1 can be slow

function env() {
  return { apiKey: process.env.OPENAI_API_KEY ?? "", model: process.env.IMAGE_MODEL ?? "gpt-image-1" };
}

// OpenAI accepts three concrete sizes; map the requested ad ratio onto the nearest one (composition crops
// to the exact format afterwards).
function sizeFor(ratio: string): "1024x1024" | "1536x1024" | "1024x1536" {
  const landscape = new Set(["16:9", "1.91:1", "3:2", "4:3", "21:9", "5:4"]);
  const portrait = new Set(["9:16", "4:5", "2:3", "3:4"]);
  if (landscape.has(ratio)) return "1536x1024";
  if (portrait.has(ratio)) return "1024x1536";
  return "1024x1024";
}

// Fill a format renderRecipe's bracket tokens with the real product name; blank leftover placeholders so no
// literal "[thing]" reaches the model. (Kept local — mirrors google-gemini's fillRecipe; the two providers
// stay independent per the adapter convention.)
function fillRecipe(recipe: string, productName: string): string {
  return recipe
    .replace(/\[product\]/gi, productName)
    .replace(/\[(x|thing)\]/gi, "product")
    .replace(/\[(routine|category|benefit|result)\]/gi, (_m, w: string) => w.toLowerCase())
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Two modes, matching the Google adapter so BOTH providers render the 42 formats identically:
//  - SCENE mode (brief.renderRecipe set): build the ACTUAL format scene (a Reddit post, comparison table,
//    iMessage thread...). When the format's chrome text is part of the scene (sceneText "render") the model
//    draws the copy verbatim; otherwise text is forbidden and the deterministic compositor adds it. This is
//    what makes an ad LOOK like a real ad format instead of a generic editorial background.
//  - BACKGROUND mode (no recipe): an art-directed, text-free campaign visual the compositor draws copy over.
function buildPrompt(brief: GenerationBrief): string {
  const b = brief.brandDNA;
  const c = brief.concept;
  const style = [b.imageStyle, b.designStyle].filter((s) => s && s !== "UNKNOWN").join(", ");
  const palette = [b.palette.primary, b.palette.secondary, b.palette.background].filter((x) => x && x !== "UNKNOWN").join(", ");
  const productLine =
    brief.productMode === "composite"
      ? "Do NOT draw, include, or imagine the product itself. Leave a clean, well-lit, uncluttered empty area in the upper-central part of the frame where the real product image will be composited afterward."
      : brief.requiredProductFidelity
        ? "Feature the product EXACTLY as in the reference image - same packaging, label, shape, colour and on-pack text; do not redesign or restyle it."
        : "";

  if (brief.renderRecipe) {
    const scene = fillRecipe(brief.renderRecipe, brief.productDNA.name);
    const renderText = brief.sceneText === "render";
    const copy = renderText
      ? [
          c.headline ? `Headline / main line: "${c.headline}".` : "",
          c.supportingCopy ? `Supporting copy: "${c.supportingCopy}".` : "",
          c.offer ? `Offer badge text: "${c.offer}".` : "",
          c.cta ? `Button / call-to-action text: "${c.cta}".` : "",
        ].filter(Boolean).join(" ")
      : "";
    return [
      `Create a Meta/Instagram static ad for the product "${brief.productDNA.name}" in this EXACT format:`,
      scene,
      style ? `Visual style: ${style}.` : "",
      palette ? `Use the brand colours: ${palette}.` : "",
      productLine,
      renderText
        ? `Render all text in the scene crisply and CORRECTLY SPELLED, high-contrast and legible on a phone. Use this copy verbatim where the layout calls for words: ${copy}`
        : "Leave clean negative space for a headline and a call-to-action button to be added later. Render NO text, NO words, NO letters, NO watermarks - text is added separately.",
      "Photorealistic where the format is a real-world scene; pixel-accurate UI where the format mimics an app or interface.",
      ...brief.negativeInstructions.map((n) => `Avoid: ${n}.`),
    ].filter(Boolean).join(" ");
  }

  // BACKGROUND mode — art-directed campaign visual (text-free; compositor draws copy over it).
  const bigIdea = [c.angle, c.hook].filter(Boolean).join(" - ") || c.coreMessage || brief.productDNA.name;
  const feel = [c.desire, c.problem ? `speaks to someone dealing with ${c.problem}` : ""].filter(Boolean).join("; ");
  return [
    `A scroll-stopping, editorial-grade advertising visual for "${brief.productDNA.name}" - top DTC creative-studio quality, NOT a generic stock background.`,
    `The single big idea to express visually: ${bigIdea}.`,
    c.visualDirection ? `Art direction / scene: ${c.visualDirection}.` : "",
    feel ? `It should make the viewer feel: ${feel}.` : "",
    "Composition: one clear hero focal point, rule-of-thirds, cinematic depth of field, rich lighting with real shadows, tactile texture, a considered colour story, and intentional clean negative space in the upper-central frame for a headline and CTA added later.",
    style ? `Visual style: ${style}.` : "",
    palette ? `Build the colour story around the brand colours: ${palette}.` : "",
    productLine,
    "Photorealistic, premium, art-directed - it should stop the thumb.",
    "Render NO text, NO words, NO letters, NO logos, NO watermarks - text is added separately.",
    ...brief.negativeInstructions.map((n) => `Avoid: ${n}.`),
  ].filter(Boolean).join(" ");
}

function b64ToBlob(b64: string, type = "image/png"): Blob {
  return new Blob([Buffer.from(b64, "base64")], { type });
}

// Text-to-image generation (no input image).
async function generate(model: string, brief: GenerationBrief): Promise<GenerationResult> {
  const { apiKey } = env();
  if (!apiKey) return { ok: false, provider: "openai", model, costUsd: 0, promptVersion: brief.promptVersion, error: "OPENAI_API_KEY not set" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    // gpt-image-1 returns b64_json by default; do NOT send response_format (only dall-e supports it).
    const res = await fetch(GEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt: buildPrompt(brief), size: sizeFor(brief.aspectRatioRequest), n: 1 }),
      signal: controller.signal,
    });
    return await readResult(res, model, brief);
  } catch (e) {
    return { ok: false, provider: "openai", model, costUsd: 0, promptVersion: brief.promptVersion, error: e instanceof Error ? e.message : "request failed" };
  } finally {
    clearTimeout(timer);
  }
}

// Image edit / variant (an input image is provided). Uses multipart /images/edits.
async function edit(model: string, brief: GenerationBrief, baseImageBase64: string): Promise<GenerationResult> {
  const { apiKey } = env();
  if (!apiKey) return { ok: false, provider: "openai", model, costUsd: 0, promptVersion: brief.promptVersion, error: "OPENAI_API_KEY not set" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", buildPrompt(brief));
    form.append("size", sizeFor(brief.aspectRatioRequest));
    form.append("n", "1");
    form.append("image", b64ToBlob(baseImageBase64), "base.png");
    const res = await fetch(EDIT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` }, // no Content-Type: fetch sets the multipart boundary
      body: form,
      signal: controller.signal,
    });
    return await readResult(res, model, brief);
  } catch (e) {
    return { ok: false, provider: "openai", model, costUsd: 0, promptVersion: brief.promptVersion, error: e instanceof Error ? e.message : "request failed" };
  } finally {
    clearTimeout(timer);
  }
}

async function readResult(res: Response, model: string, brief: GenerationBrief): Promise<GenerationResult> {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, provider: "openai", model, costUsd: 0, promptVersion: brief.promptVersion, error: `HTTP ${res.status}: ${detail.slice(0, 200)}` };
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const data = json.data?.[0]?.b64_json;
  if (!data) return { ok: false, provider: "openai", model, costUsd: 0, promptVersion: brief.promptVersion, error: "no image in response" };
  return { ok: true, imageBase64: data, mimeType: "image/png", provider: "openai", model, costUsd: priceFor(model), promptVersion: brief.promptVersion };
}

export const openaiImageProvider: ImageProvider = {
  name: "openai",
  getCapabilities(): ProviderCapabilities {
    return { generation: true, editing: true, referenceImages: 1, aspectRatios: ["1:1", "16:9", "9:16", "3:2", "2:3", "4:5", "4:3"], maxResolution: "1536" };
  },
  getCostEstimate(briefs: GenerationBrief[]): CostEstimate {
    return estimateCost(briefs, "openai", env().model);
  },
  async generateCreative(brief: GenerationBrief): Promise<GenerationResult> {
    // If product fidelity is required and we have a reference image, edit from it; else pure generation.
    return generate(env().model, brief);
  },
  async editCreative(brief, baseImageBase64): Promise<GenerationResult> {
    return edit(env().model, brief, baseImageBase64);
  },
  async generateVariant(brief, parentImageBase64): Promise<GenerationResult> {
    return edit(env().model, { ...brief, negativeInstructions: [...brief.negativeInstructions, "make it visibly different from the reference composition"] }, parentImageBase64);
  },
  async getGenerationStatus(): Promise<"done"> {
    return "done"; // synchronous API; no async job to poll
  },
};
