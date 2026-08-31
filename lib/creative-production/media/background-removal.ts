// Creative Production - BACKGROUND REMOVAL (product-fidelity path). Turns the real Shopify hero image into a
// transparent-background cutout so the compositor can place the ACTUAL product pixels onto the generated
// format scene - the model never redraws the product (Google's own guidance: preserve anything a viewer can
// recognise or verify; let the model change only the background). Provider-independent + keyless-graceful,
// mirroring the ImageProvider pattern: with a key we return a clean cutout; with NO key we still return the
// real product (uncut) so fidelity is never sacrificed, just the clean edge. Relative imports + no
// server-only so scripts/check-cp-background-removal.ts can load selectRemover() in plain node.
import { fetchWithTimeout } from "../../http.ts";
import { isPublicHttpsUrl } from "../../ssrf.ts";

export type Remover = "photoroom" | "removebg" | "none";
export type Cutout = { dataUri: string; removed: boolean }; // removed=false -> real product but with its original background

// PURE: pick the removal provider from env (key presence only). Photoroom preferred (more accurate + cheaper
// per research); remove.bg fallback; "none" = keyless stub (return the real image uncut). No I/O -> gate-able.
export function selectRemover(env: { PHOTOROOM_API_KEY?: string; REMOVEBG_API_KEY?: string }): Remover {
  if (env.PHOTOROOM_API_KEY && env.PHOTOROOM_API_KEY.trim()) return "photoroom";
  if (env.REMOVEBG_API_KEY && env.REMOVEBG_API_KEY.trim()) return "removebg";
  return "none";
}

const REMOVE_TIMEOUT_MS = 20_000;
const MAX_BYTES = 18_000_000;

async function fetchImageBytes(url: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
  if (!(await isPublicHttpsUrl(url))) return null; // SSRF guard: product image URLs are external data
  const res = await fetchWithTimeout(url, {}, REMOVE_TIMEOUT_MS);
  if (!res.ok) return null;
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  if (!mimeType.startsWith("image/")) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_BYTES) return null;
  return { bytes, mimeType };
}

function toDataUri(bytes: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

// Photoroom "Remove Background" API (sdk.photoroom.com/v1/segment). Returns a transparent PNG.
async function viaPhotoroom(bytes: Buffer, mimeType: string, key: string): Promise<Cutout | null> {
  const form = new FormData();
  form.append("image_file", new Blob([new Uint8Array(bytes)], { type: mimeType }), "product");
  form.append("format", "png");
  const res = await fetchWithTimeout("https://sdk.photoroom.com/v1/segment", { method: "POST", headers: { "x-api-key": key }, body: form }, REMOVE_TIMEOUT_MS);
  if (!res.ok) return null;
  const out = Buffer.from(await res.arrayBuffer());
  if (!out.length) return null;
  return { dataUri: toDataUri(out, "image/png"), removed: true };
}

// remove.bg API (api.remove.bg/v1.0/removebg). Returns a transparent PNG.
async function viaRemoveBg(bytes: Buffer, mimeType: string, key: string): Promise<Cutout | null> {
  const form = new FormData();
  form.append("image_file", new Blob([new Uint8Array(bytes)], { type: mimeType }), "product");
  form.append("size", "auto");
  const res = await fetchWithTimeout("https://api.remove.bg/v1.0/removebg", { method: "POST", headers: { "X-Api-Key": key }, body: form }, REMOVE_TIMEOUT_MS);
  if (!res.ok) return null;
  const out = Buffer.from(await res.arrayBuffer());
  if (!out.length) return null;
  return { dataUri: toDataUri(out, "image/png"), removed: true };
}

/**
 * Produce a product cutout data URI from a product image URL.
 *  - with a provider key -> transparent-background cutout ({ removed: true }).
 *  - no key, or the provider call fails -> the REAL product image uncut ({ removed: false }) so fidelity
 *    is preserved (real pixels) even without a removal key; the compositor frames it as a product card.
 *  - null only when the source image itself cannot be fetched (nothing real to show).
 */
export async function productCutout(imageUrl: string | null | undefined): Promise<Cutout | null> {
  if (!imageUrl) return null;
  const src = await fetchImageBytes(imageUrl).catch(() => null);
  if (!src) return null;
  const remover = selectRemover({ PHOTOROOM_API_KEY: process.env.PHOTOROOM_API_KEY, REMOVEBG_API_KEY: process.env.REMOVEBG_API_KEY });
  try {
    if (remover === "photoroom") return (await viaPhotoroom(src.bytes, src.mimeType, process.env.PHOTOROOM_API_KEY!)) ?? { dataUri: toDataUri(src.bytes, src.mimeType), removed: false };
    if (remover === "removebg") return (await viaRemoveBg(src.bytes, src.mimeType, process.env.REMOVEBG_API_KEY!)) ?? { dataUri: toDataUri(src.bytes, src.mimeType), removed: false };
  } catch {
    // fall through to the uncut real image
  }
  return { dataUri: toDataUri(src.bytes, src.mimeType), removed: false };
}
