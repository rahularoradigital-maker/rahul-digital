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

// PURE: is a raw RGBA buffer's BORDER a near-uniform light (white/very-light-grey) background? Shopify hero
// shots are almost always the product on clean white, so a deterministic white-key gives a real transparent
// cutout with NO API key. We only key when the border is genuinely light, so a lifestyle/coloured-bg photo is
// never mangled - it falls back to the uncut image. Samples the 4 edges (every 4th px) and requires >=92% light.
export function borderIsLight(data: Uint8Array | Buffer, width: number, height: number, channels: number): boolean {
  const LIGHT = 236; // per-channel min to count as "light background"
  let light = 0, total = 0;
  const test = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    total++;
    if (data[i] >= LIGHT && data[i + 1] >= LIGHT && data[i + 2] >= LIGHT) light++;
  };
  for (let x = 0; x < width; x += 4) { test(x, 0); test(x, height - 1); }
  for (let y = 0; y < height; y += 4) { test(0, y); test(width - 1, y); }
  return total > 0 && light / total >= 0.92;
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

// KEYLESS transparent cutout for product-on-white e-commerce shots (the Shopify hero norm). Uses sharp (already
// present for Next image optimisation - no new dep) to flood-fill the EDGE-CONNECTED light background to alpha.
// Edge-connected only, so white INSIDE the product (a white logo, a light panel not touching the border) is
// preserved - a plain "all white -> transparent" threshold would punch holes in the product. Downscaled to
// 1200px first for speed + a smaller PNG. sharp is dynamically imported so this module still loads in plain node
// (the gate's selectRemover/borderIsLight checks never pull in the native binding).
async function viaWhiteKey(bytes: Buffer): Promise<Cutout | null> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(bytes)
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4 || !borderIsLight(data, width, height, channels)) return null; // not a clean light bg -> caller keeps the uncut image
  const LIGHT = 236;
  const isLight = (p: number) => { const i = p * channels; return data[i] >= LIGHT && data[i + 1] >= LIGHT && data[i + 2] >= LIGHT; };
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const seed = (x: number, y: number) => { if (x < 0 || y < 0 || x >= width || y >= height) return; const p = y * width + x; if (visited[p] || !isLight(p)) return; visited[p] = 1; stack.push(p); };
  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }
  while (stack.length) {
    const p = stack.pop()!;
    data[p * channels + 3] = 0; // punch this edge-connected light pixel transparent
    const x = p % width, y = (p / width) | 0;
    seed(x + 1, y); seed(x - 1, y); seed(x, y + 1); seed(x, y - 1);
  }
  const out = await sharp(data, { raw: { width, height, channels } }).png().toBuffer();
  return { dataUri: toDataUri(out, "image/png"), removed: true };
}

// Cache cutouts per source URL for this process: the pipeline calls productCutout once PER FORMAT in a batch,
// but the source image (and its cutout) is identical across formats - cut once, reuse.
const cutoutCache = new Map<string, Cutout | null>();

/**
 * Produce a product cutout data URI from a product image URL (the Shopify FIRST image, passed by the pipeline).
 *  - with a provider key -> transparent-background cutout ({ removed: true }).
 *  - no key but a clean light background -> KEYLESS transparent cutout via sharp white-key ({ removed: true }).
 *  - no key and a non-white background (or the call fails) -> the REAL product image uncut ({ removed: false })
 *    so fidelity is preserved even without a removal key; the compositor frames it as a product card.
 *  - null only when the source image itself cannot be fetched (nothing real to show).
 */
export async function productCutout(imageUrl: string | null | undefined): Promise<Cutout | null> {
  if (!imageUrl) return null;
  if (cutoutCache.has(imageUrl)) return cutoutCache.get(imageUrl)!;
  const src = await fetchImageBytes(imageUrl).catch(() => null);
  if (!src) return null;
  const remover = selectRemover({ PHOTOROOM_API_KEY: process.env.PHOTOROOM_API_KEY, REMOVEBG_API_KEY: process.env.REMOVEBG_API_KEY });
  let result: Cutout = { dataUri: toDataUri(src.bytes, src.mimeType), removed: false };
  try {
    if (remover === "photoroom") result = (await viaPhotoroom(src.bytes, src.mimeType, process.env.PHOTOROOM_API_KEY!)) ?? result;
    else if (remover === "removebg") result = (await viaRemoveBg(src.bytes, src.mimeType, process.env.REMOVEBG_API_KEY!)) ?? result;
    else result = (await viaWhiteKey(src.bytes)) ?? result; // no paid key -> deterministic white-key for product-on-white
  } catch {
    // fall through to the uncut real image
  }
  cutoutCache.set(imageUrl, result);
  return result;
}
