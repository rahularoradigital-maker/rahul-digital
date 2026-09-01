import { callGemini, fetchInlineImage, stringObjectSchema, type InlineImage } from "../gemini.ts";
import { parseDeepRead, type DeepRead } from "./deep-analysis-pure.ts";
export type { DeepRead };

// Deep creative read: for a VIDEO this reads the real motion (not just the cover frame) by inlining the
// video to Gemini; for an IMAGE it reads the real asset. Strictly bounded by the caller (top-10, one-time).
// Every path degrades to null on failure so a read is never fabricated - the caller falls back to the
// existing cover-frame read and says so.

const GRAPH = "https://graph.facebook.com/v21.0";
const MAX_VIDEO_BYTES = 18 * 1024 * 1024; // Gemini inline_data request limit is ~20MB; stay safely under.
const VIDEO_TIMEOUT_MS = 30_000;

const DEEP_SCHEMA = stringObjectSchema(["sceneType", "setting", "palette", "visualMood", "contentSubject", "funnelStage", "motionSummary"]);

const PROMPT =
  "You are a senior performance-creative strategist. Study this ONE ad creative (a video or an image) and classify what is actually shown. Return JSON with exactly these keys:\n" +
  "- sceneType: one of talking-head, product-demo, lifestyle, text-card, unboxing, before-after, animation, other.\n" +
  "- setting: one of studio, indoor, outdoor, on-white, app-screen, other.\n" +
  "- palette: the dominant colours in 1-3 words (e.g. warm pastels, bold red and black).\n" +
  "- visualMood: the single visual mood in one word (e.g. energetic, calm, premium, urgent).\n" +
  "- contentSubject: a short phrase for what is literally shown.\n" +
  "- funnelStage: TOF, MOF, or BOF based on the buyer intent the creative signals.\n" +
  "- motionSummary: for a VIDEO, one short sentence on what CHANGES across it - the hook in the first seconds, the sequence, the pace. For a still IMAGE, return an empty string.\n" +
  "Judge only what is visible. Never invent detail you cannot see.";

// Fetch a Meta video's playable source URL from its video_id (Bearer auth, mirroring meta-source).
async function videoSourceUrl(videoId: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(videoId)}?fields=source`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const json = (await res.json()) as { source?: string };
    return json.source ?? null;
  } catch {
    return null;
  }
}

// Download the video and base64-inline it, guarded by a hard size cap so a large file never blows the
// request limit. Returns null if too big or unreachable (caller falls back to the cover frame).
async function fetchInlineVideo(url: string): Promise<InlineImage | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), VIDEO_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > MAX_VIDEO_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_VIDEO_BYTES) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4";
    return { data: buf.toString("base64"), mimeType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Deep read of ONE video: fetch its source, inline it, read motion + visuals. null on any failure.
export async function deepReadVideo(videoId: string, token: string): Promise<DeepRead | null> {
  const src = await videoSourceUrl(videoId, token);
  if (!src) return null;
  const inline = await fetchInlineVideo(src);
  if (!inline) return null;
  return parseDeepRead(await callGemini(PROMPT, DEEP_SCHEMA, inline), true);
}

// Deep read of ONE image (the real asset). null on any failure.
export async function deepReadImage(imageUrl: string): Promise<DeepRead | null> {
  const inline = await fetchInlineImage(imageUrl);
  if (!inline) return null;
  return parseDeepRead(await callGemini(PROMPT, DEEP_SCHEMA, inline), false);
}
