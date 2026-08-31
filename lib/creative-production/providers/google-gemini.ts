import "server-only";
import { fetchWithTimeout } from "@/lib/http";
import { isPublicHttpsUrl } from "@/lib/ssrf";
import { priceFor, estimateCost } from "./pricing.ts";
import type { ImageProvider, GenerationBrief, GenerationResult, ProviderCapabilities, CostEstimate } from "@/lib/creative-production/types";

// Google Gemini image provider (Creative Production, Phase 6). Implements the ImageProvider interface over
// the classic generateContent endpoint (matches AdBrain's no-SDK, fetch-in-header convention). Model is
// ENV-DRIVEN so it swaps without a code change; product fidelity via reference images (inlineData). The AI
// renders the VISUAL only - the deterministic composition layer draws precise text (Google's own docs warn
// the model misspells), so the prompt explicitly forbids text. Key is server-side only (x-goog-api-key).
//
// ⚠️ Verify live before relying on it: the exact 3.x `-preview` model id and the generateContent-vs-
// interactions endpoint (Google's docs are inconsistent). probeImageProvider() below is the check.

const GEN_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const IMAGE_TIMEOUT_MS = 60_000;

function env() {
  return {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.IMAGE_MODEL ?? "gemini-3.1-flash-image-preview",
    fallback: process.env.IMAGE_FALLBACK_MODEL ?? "gemini-2.5-flash-image",
  };
}

// Native aspect ratios the models accept; 1.91:1 is not native (request 16:9, crop in composition).
const NATIVE_RATIOS = new Set(["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]);
function nativeRatio(request: string): string {
  return NATIVE_RATIOS.has(request) ? request : "16:9";
}

// Fill a format renderRecipe's bracket tokens with the real product name; blank any leftover placeholders so
// no literal "[thing]" reaches the model. Keeps recipes product-agnostic in the library, concrete at runtime.
function fillRecipe(recipe: string, productName: string): string {
  return recipe
    .replace(/\[product\]/gi, productName)
    .replace(/\[(x|thing)\]/gi, "product")
    .replace(/\[(routine|category|benefit|result)\]/gi, (_m, w: string) => w.toLowerCase())
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Build the image prompt from the brief. Two modes:
//  - SCENE mode (brief.renderRecipe set, from the 42-format library): the model builds the ACTUAL format scene
//    (a Reddit post, an iMessage thread, a Google-search page). When the format's chrome text is part of the
//    scene (sceneText "render") the model draws the copy verbatim; when it is not (sceneText "space") we still
//    forbid text and the deterministic compositor adds it. This is what makes ads look like real ad formats.
//  - BACKGROUND mode (no recipe / legacy concept): the original behaviour - a text-free background the
//    compositor draws exact copy over. Product fidelity is anchored by the reference image + instruction.
function buildPrompt(brief: GenerationBrief): string {
  const b = brief.brandDNA;
  const c = brief.concept;
  const style = [b.imageStyle, b.designStyle].filter((s) => s && s !== "UNKNOWN").join(", ");
  const palette = [b.palette.primary, b.palette.secondary, b.palette.background].filter((c) => c && c !== "UNKNOWN").join(", ");
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

  return [
    `Advertising background visual for "${brief.productDNA.name}". Concept: ${c.visualDirection}. Angle: ${c.angle}.`,
    style ? `Visual style: ${style}.` : "",
    palette ? `Brand colours to feature: ${palette}.` : "",
    productLine,
    "Leave clean negative space for a headline and a call-to-action button to be added later.",
    "IMPORTANT: render NO text, NO words, NO letters, NO logos, NO watermarks in the image - text is added separately.",
    ...brief.negativeInstructions.map((n) => `Avoid: ${n}.`),
  ].filter(Boolean).join(" ");
}

async function inlineReference(url: string): Promise<{ mimeType: string; data: string } | null> {
  if (!(await isPublicHttpsUrl(url))) return null; // SSRF guard: product image URLs are external data
  try {
    const res = await fetchWithTimeout(url, {}, 15_000);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 18_000_000) return null; // inline cap ~20MB total request
    return { mimeType, data: buf.toString("base64") };
  } catch {
    return null;
  }
}

async function callModel(model: string, brief: GenerationBrief, extraImageBase64?: { mimeType: string; data: string }): Promise<GenerationResult> {
  const { apiKey } = env();
  if (!apiKey) return { ok: false, provider: "google", model, costUsd: 0, promptVersion: brief.promptVersion, error: "GEMINI_API_KEY not set" };

  const parts: Record<string, unknown>[] = [{ text: buildPrompt(brief) }];
  // Attach the product reference only when the MODEL should draw it (in-scene / legacy background fidelity).
  // For "composite" formats we place the real product ourselves downstream, so feeding it here would only
  // tempt the model to redraw the SKU - the exact fidelity bug the composite path removes.
  const attachRefs = brief.requiredProductFidelity && brief.productMode !== "composite";
  const refs = attachRefs ? await Promise.all(brief.referenceImages.slice(0, 4).map(inlineReference)) : [];
  for (const r of refs) if (r) parts.push({ inlineData: r });
  if (extraImageBase64) parts.push({ inlineData: extraImageBase64 });

  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: nativeRatio(brief.aspectRatioRequest) } },
  };
  try {
    const res = await fetchWithTimeout(
      `${GEN_URL}/${model}:generateContent`,
      { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(body) },
      IMAGE_TIMEOUT_MS,
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, provider: "google", model, costUsd: 0, promptVersion: brief.promptVersion, error: `HTTP ${res.status}: ${detail.slice(0, 200)}` };
    }
    const json = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    const data = part?.inlineData?.data;
    if (!data) return { ok: false, provider: "google", model, costUsd: 0, promptVersion: brief.promptVersion, error: "no image in response" };
    return { ok: true, imageBase64: data, mimeType: part?.inlineData?.mimeType ?? "image/png", provider: "google", model, costUsd: priceFor(model), promptVersion: brief.promptVersion };
  } catch (e) {
    return { ok: false, provider: "google", model, costUsd: 0, promptVersion: brief.promptVersion, error: e instanceof Error ? e.message : "request failed" };
  }
}

export const googleImageProvider: ImageProvider = {
  name: "google",
  getCapabilities(): ProviderCapabilities {
    return { generation: true, editing: true, referenceImages: 4, aspectRatios: [...NATIVE_RATIOS], maxResolution: "4K" };
  },
  getCostEstimate(briefs: GenerationBrief[]): CostEstimate {
    return estimateCost(briefs, "google", env().model);
  },
  async generateCreative(brief: GenerationBrief): Promise<GenerationResult> {
    const { model, fallback } = env();
    const first = await callModel(model, brief);
    if (first.ok || model === fallback) return first;
    // Fallback model on a hard failure (e.g. a preview id that 404s) - the ⚠️ id-verification safety net.
    const second = await callModel(fallback, brief);
    return second.ok ? second : first;
  },
  async editCreative(brief, baseImageBase64): Promise<GenerationResult> {
    const { model } = env();
    return callModel(model, brief, { mimeType: "image/png", data: baseImageBase64 });
  },
  async generateVariant(brief, parentImageBase64): Promise<GenerationResult> {
    const { model } = env();
    return callModel(model, { ...brief, negativeInstructions: [...brief.negativeInstructions, "make it visibly different from the reference composition"] }, { mimeType: "image/png", data: parentImageBase64 });
  },
  async getGenerationStatus(): Promise<"done"> {
    return "done"; // generateContent is synchronous; no async job to poll
  },
};

/** Probe the live model id + endpoint (mirror probeGemini). Returns a short status for diagnostics. */
export async function probeImageProvider(): Promise<{ ok: boolean; model: string; detail: string }> {
  const { model } = env();
  const brief = {
    brandDNA: { palette: { primary: "UNKNOWN", secondary: "UNKNOWN", background: "UNKNOWN", text: "UNKNOWN" }, fonts: { heading: "UNKNOWN", body: "UNKNOWN" }, logoUrl: null, imageStyle: "UNKNOWN", designStyle: "UNKNOWN", ctaStyle: "UNKNOWN", tone: "UNKNOWN", density: "UNKNOWN", source: "derived", version: 1 },
    productDNA: { productId: "probe", name: "a red apple on a plain background", images: [], price: null, discount: null },
    format: { id: "probe", platform: "meta", name: "probe", width: 1080, height: 1080, aspectRatio: "1:1", purpose: "probe", safeZone: { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 }, textConstraints: "", exportFormat: "png", version: "2026-07", source: "" },
    concept: { id: "probe", formatId: "probe", hook: "", angle: "clean studio product shot", headline: "", supportingCopy: "", cta: "", offer: null, visualDirection: "a red apple, studio lighting" },
    aspectRatioRequest: "1:1",
    restrictions: [],
    requiredProductFidelity: false,
    negativeInstructions: [],
    referenceImages: [],
    promptVersion: "probe",
  } as GenerationBrief;
  const r = await callModel(model, brief);
  return { ok: r.ok, model, detail: r.ok ? "image returned" : r.error ?? "failed" };
}
