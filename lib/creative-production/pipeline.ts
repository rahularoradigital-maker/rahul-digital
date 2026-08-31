import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBrandId } from "@/lib/tenancy/resolve";
import { getImageProvider } from "./providers/registry.ts";
import { getFormat } from "./formats/ad-formats.ts";
import { getAdFormat } from "./formats/ad-format-library.ts";
import { briefHash } from "./generation/brief-hash.ts";
import { compose } from "./composition/compose.ts";
import { runQA } from "./qa/qa-engine.ts";
import type { AdFormat, BrandDNA, CreativeAssetRecord, CreativeConcept, GenerationBrief, ProductDNA } from "@/lib/creative-production/types";

// Creative Production - ORCHESTRATION (Phases 6-10). Turns one approved concept into finished, QA'd,
// stored assets across the requested formats. The heavy provider call and the deterministic compositor
// are separated (rule 17): the provider draws the VISUAL, compose() draws the exact text. Cost control:
// identical briefs are cache-keyed by briefHash - a re-run of the same brief is skipped, never re-billed.
// Everything degrades gracefully; a single format failing does not abort the batch.

const PROMPT_VERSION = "cp-v1";
const BUCKET = "cp-assets";

// 1.91:1 is not a native model ratio; ask for 16:9 and let compose()/crop handle the frame.
function nativeAspect(format: AdFormat): string {
  return format.aspectRatio === "1.91:1" ? "16:9" : format.aspectRatio;
}

function buildBrief(product: ProductDNA, brand: BrandDNA, concept: CreativeConcept, format: AdFormat): GenerationBrief {
  // If the concept was generated from the 42-format executional library, carry its render recipe through so
  // the image model builds the actual format scene. Unknown/legacy formatIds -> undefined -> background mode.
  const tpl = getAdFormat(concept.formatId);
  // A "none" format (pure UI/typographic, no physical product) never needs product fidelity even if we have an image.
  const needsProduct = product.images.length > 0 && tpl?.productMode !== "none";
  return {
    brandDNA: brand,
    productDNA: { productId: product.productId, name: product.name, images: product.images, price: product.price, discount: product.discount },
    format,
    concept: { id: concept.id, formatId: concept.formatId, hook: concept.hook, angle: concept.angle, headline: concept.headline, supportingCopy: concept.supportingCopy, cta: concept.cta, offer: concept.offer, visualDirection: concept.visualDirection },
    aspectRatioRequest: nativeAspect(format),
    restrictions: product.creativeRestrictions,
    requiredProductFidelity: needsProduct,
    negativeInstructions: [],
    referenceImages: product.images,
    promptVersion: PROMPT_VERSION,
    renderRecipe: tpl?.renderRecipe,
    sceneText: tpl?.sceneText,
    productMode: tpl?.productMode,
  };
}

async function storeSvg(path: string, svg: string): Promise<boolean> {
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(path, new Blob([svg], { type: "image/svg+xml" }), { contentType: "image/svg+xml", upsert: true });
  return !error;
}

export async function generateAssetsForConcept(
  userId: string,
  product: ProductDNA,
  brand: BrandDNA,
  concept: CreativeConcept,
  formats: AdFormat[],
): Promise<CreativeAssetRecord[]> {
  const provider = await getImageProvider();
  const admin = createAdminClient();
  const out: CreativeAssetRecord[] = [];
  const approved = { headline: concept.headline, subhead: concept.supportingCopy, cta: concept.cta, offer: concept.offer };
  const brandId = await getActiveBrandId(userId); // tag every generated asset/generation with the current brand

  for (const format of formats) {
    const brief = buildBrief(product, brand, concept, format);
    const hash = briefHash(brief);
    const generationId = `gen_${concept.id}_${hash}`;
    const creativeId = `${generationId}_${format.id}`;

    // Cost control: identical brief already produced this creative -> reuse, do not re-generate/re-bill.
    const { data: existing } = await admin.from("cp_assets").select("*").eq("user_id", userId).eq("creative_id", creativeId).maybeSingle();
    if (existing) {
      out.push(recordFromRow(existing));
      continue;
    }

    // 1) AI VISUAL (provider draws no text). Stub/degraded provider returns a placeholder so the pipeline
    //    still completes end-to-end without an image key.
    const gen = await provider.generateCreative(brief);
    const visualDataUri = gen.ok && gen.imageBase64 ? `data:${gen.mimeType ?? "image/png"};base64,${gen.imageBase64}` : null;

    // 2) DETERMINISTIC COMPOSE (exact approved text over the visual).
    const composed = compose(brief, approved, visualDataUri);

    // 3) QA.
    const qa = runQA(composed, brief, approved, {
      textPixelsPresent: true,
      productFidelityRisk: !gen.ok && brief.requiredProductFidelity, // no real visual -> flag fidelity when required
      fileBytes: Buffer.byteLength(composed.svg, "utf8"),
    });

    // 4) STORE svg + records.
    const storagePath = `${userId}/${generationId}/${format.id}.svg`;
    await storeSvg(storagePath, composed.svg);

    const now = new Date().toISOString();
    const record: CreativeAssetRecord = {
      creativeId,
      version: 1,
      parentCreativeId: null,
      conceptId: concept.id,
      productId: product.productId,
      generationId,
      formatId: format.id,
      provider: gen.provider,
      model: gen.model,
      promptVersion: PROMPT_VERSION,
      brandDnaVersion: brand.version,
      productDnaVersion: 1,
      storagePath,
      qa,
      approval: "draft",
      costUsd: gen.costUsd,
      createdAt: now,
    };

    await admin.from("cp_generations").upsert(
      { id: generationId, user_id: userId, brand_id: brandId, concept_id: concept.id, brief_hash: hash, provider: gen.provider, model: gen.model, prompt_version: PROMPT_VERSION, cost_usd: gen.costUsd, status: gen.ok ? "done" : "placeholder", created_at: now },
      { onConflict: "user_id,id" },
    ).then(undefined, () => {});

    await admin.from("cp_assets").upsert(
      {
        creative_id: creativeId, user_id: userId, brand_id: brandId, version: 1, parent_creative_id: null, concept_id: concept.id, product_id: product.productId,
        generation_id: generationId, format_id: format.id, provider: gen.provider, model: gen.model, prompt_version: PROMPT_VERSION,
        brand_dna_version: brand.version, product_dna_version: 1, storage_path: storagePath, qa, approval: "draft", cost_usd: gen.costUsd, edits: null, created_at: now,
      },
      { onConflict: "user_id,creative_id,version" },
    ).then(undefined, () => {});

    out.push(record);
  }
  return out;
}

function recordFromRow(row: Record<string, unknown>): CreativeAssetRecord {
  return {
    creativeId: String(row.creative_id),
    version: Number(row.version ?? 1),
    parentCreativeId: (row.parent_creative_id as string | null) ?? null,
    conceptId: String(row.concept_id),
    productId: String(row.product_id),
    generationId: String(row.generation_id),
    formatId: String(row.format_id),
    provider: String(row.provider),
    model: String(row.model),
    promptVersion: String(row.prompt_version),
    brandDnaVersion: Number(row.brand_dna_version ?? 1),
    productDnaVersion: Number(row.product_dna_version ?? 1),
    storagePath: String(row.storage_path),
    qa: row.qa as CreativeAssetRecord["qa"],
    approval: row.approval as CreativeAssetRecord["approval"],
    costUsd: Number(row.cost_usd ?? 0),
    createdAt: String(row.created_at),
  };
}

// A signed URL to view/download a stored asset SVG (bucket is private). Short-lived.
export async function signedAssetUrl(storagePath: string, expiresSeconds = 3600): Promise<string | null> {
  const { data } = await createAdminClient().storage.from(BUCKET).createSignedUrl(storagePath, expiresSeconds);
  return data?.signedUrl ?? null;
}

export { getFormat };
