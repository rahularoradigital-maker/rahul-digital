import "server-only";
import { createAdminClient } from "../supabase/admin.ts";
import { runTaskJson } from "../ai/router.ts";
import { compose } from "../ai/compose.ts";
import { callGemini, fetchInlineImage, stringObjectSchema } from "../gemini.ts";
import { isKilled } from "../security/flags.ts";
import { aiBudgetExceeded } from "../ai/budget.ts";
import type { CreativeAsset } from "./fingerprint.ts";
import { thumbUrlOf } from "./fingerprint.ts";

// Semantic creative decode - the layer that turns each ad's copy into the dimensions the diversity engine
// reads beyond the free `format`: funnel stage, hook, emotion, subject. FINGERPRINT-ONCE: keyed by
// content_hash so each unique creative is decoded by the model exactly once and reused forever (the cost
// control). Copy-based (headline/body/CTA carry most of the signal) - cheaper than vision and no image fetch.
// Everything degrades gracefully to nulls, in which case the diversity engine simply reads on `format` alone
// (its prior behaviour) - so this can never break the cockpit. Untrusted ad copy is fenced (compose).

// Copy dimensions (funnelStage/hookType/emotion/subject) + VISUAL dimensions read from the actual creative
// image/thumbnail (sceneType/setting/palette/visualMood/contentSubject). Both keyed by content_hash.
export type CreativeSemantics = {
  funnelStage: string | null;
  hookType: string | null;
  emotion: string | null;
  subject: string | null;
  sceneType: string | null; // talking-head | product-demo | lifestyle | text-card | unboxing | before-after | animation | other
  setting: string | null; // studio | indoor | outdoor | on-white | app-screen | other
  palette: string | null; // 1-3 word dominant-color descriptor
  visualMood: string | null; // one word: energetic | calm | premium | playful | urgent | aspirational
  contentSubject: string | null; // short phrase of what is literally shown
};

const SCHEMA: Record<string, unknown> = { funnelStage: "TOF | MOF | BOF", hookType: "1-3 word angle", emotion: "one word", subject: "product-led | human/UGC-led | lifestyle" };

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s && s.toLowerCase() !== "null" && s.toLowerCase() !== "unknown" ? s.slice(0, 60) : null;
};

/** Read cached semantics for a set of content hashes. Best-effort (empty map on error). */
export async function readSemanticsCache(userId: string, contentHashes: string[]): Promise<Map<string, CreativeSemantics>> {
  const out = new Map<string, CreativeSemantics>();
  const hashes = [...new Set(contentHashes)].filter(Boolean);
  if (!hashes.length) return out;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("creative_semantics").select("content_hash,funnel_stage,hook_type,emotion,subject,scene_type,setting,palette,visual_mood,content_subject").eq("user_id", userId).in("content_hash", hashes);
    for (const r of (data ?? []) as { content_hash: string; funnel_stage: string | null; hook_type: string | null; emotion: string | null; subject: string | null; scene_type: string | null; setting: string | null; palette: string | null; visual_mood: string | null; content_subject: string | null }[]) {
      out.set(r.content_hash, { funnelStage: r.funnel_stage, hookType: r.hook_type, emotion: r.emotion, subject: r.subject, sceneType: r.scene_type, setting: r.setting, palette: r.palette, visualMood: r.visual_mood, contentSubject: r.content_subject });
    }
  } catch {
    /* cache unavailable -> empty -> diversity reads on format alone */
  }
  return out;
}

type CopySemantics = Pick<CreativeSemantics, "funnelStage" | "hookType" | "emotion" | "subject">;
type VisualSemantics = Pick<CreativeSemantics, "sceneType" | "setting" | "palette" | "visualMood" | "contentSubject" | "funnelStage">;

/** Decode ONE creative's copy into its four semantic dimensions, or null when there is nothing to read. */
export async function decodeCreativeCopy(asset: CreativeAsset): Promise<CopySemantics | null> {
  if (!asset.title && !asset.body) return null; // no copy -> no honest read
  const copy = [`Format: ${asset.isCatalog ? "catalog" : asset.isVideo ? "video" : asset.isCarousel ? "carousel" : "image"}`, `Headline: ${asset.title ?? ""}`, `Body: ${asset.body ?? ""}`, `CTA: ${asset.ctaType ?? ""}`].join("\n");
  const system =
    "You are a senior performance-creative strategist. Classify this ONE ad creative on four axes using ONLY its copy. Return JSON with exactly these keys:\n" +
    "- funnelStage: TOF (awareness/problem), MOF (consideration/benefit), or BOF (offer/urgency/purchase).\n" +
    "- hookType: the opening angle in 1-3 words (e.g. problem-solution, social-proof, offer, curiosity, founder-story, comparison).\n" +
    "- emotion: the single primary emotion the copy pulls on, one word (e.g. aspiration, trust, urgency, delight, fear).\n" +
    "- subject: product-led, human/UGC-led, or lifestyle.\n" +
    "Be decisive. Never invent facts beyond the copy.";
  const out = await runTaskJson("analyze-text", compose(system, [{ label: "creative_copy", content: copy }]), SCHEMA);
  if (!out) return null;
  const sem = { funnelStage: str(out.funnelStage), hookType: str(out.hookType), emotion: str(out.emotion), subject: str(out.subject) };
  return sem.funnelStage || sem.hookType || sem.emotion || sem.subject ? sem : null;
}

/** Decode up to `max` cache-MISSES and persist them (fingerprint-once). Fire-and-forget: never throws. */
export async function decodeMissing(userId: string, items: { contentHash: string; asset: CreativeAsset }[], have: Set<string>, max = 15): Promise<void> {
  const admin = createAdminClient();
  const seen = new Set<string>();
  let done = 0;
  for (const it of items) {
    if (done >= max) break;
    if (!it.contentHash || have.has(it.contentHash) || seen.has(it.contentHash)) continue;
    seen.add(it.contentHash);
    try {
      const sem = await decodeCreativeCopy(it.asset);
      if (!sem) continue;
      await admin
        .from("creative_semantics")
        .upsert({ user_id: userId, content_hash: it.contentHash, funnel_stage: sem.funnelStage, hook_type: sem.hookType, emotion: sem.emotion, subject: sem.subject, model: "gemini", updated_at: new Date().toISOString() }, { onConflict: "user_id,content_hash" })
        .then(undefined, () => {});
      done++;
    } catch {
      /* one creative's decode failing must not stop the rest */
    }
  }
}

const VISUAL_SCHEMA = stringObjectSchema(["sceneType", "setting", "palette", "visualMood", "contentSubject", "funnelStage"]);

// Decode ONE creative's actual IMAGE (or the video's thumbnail) into what is visible - scene type,
// setting, palette, mood, and a plain description of what is shown. Vision, not copy. Fingerprint-once.
// Degrades to null when there is no image or the model cannot read it, so diversity is never fabricated.
export async function decodeCreativeVisual(asset: CreativeAsset): Promise<VisualSemantics | null> {
  // §70/§100: this is a direct-to-Gemini vision call (the router can't carry an inline image), so it must
  // apply the SAME guards the router does or it escapes the global AI kill-switch + daily cost ceiling.
  if (await isKilled("ai")) return null;
  if (await aiBudgetExceeded()) return null;
  const url = thumbUrlOf(asset);
  if (!url) return null;
  const inline = await fetchInlineImage(url);
  if (!inline) return null;
  const prompt =
    "You are a senior performance-creative strategist. Look at this ONE ad creative image and classify what is actually shown. Return JSON with exactly these keys:\n" +
    "- sceneType: one of talking-head, product-demo, lifestyle, text-card, unboxing, before-after, animation, other.\n" +
    "- setting: one of studio, indoor, outdoor, on-white, app-screen, other.\n" +
    "- palette: the dominant colours in 1-3 words (e.g. warm pastels, bold red and black, muted neutrals).\n" +
    "- visualMood: the single visual mood in one word (e.g. energetic, calm, premium, playful, urgent, aspirational).\n" +
    "- contentSubject: a short phrase for what is literally shown (e.g. woman modelling a kurta outdoors, product flatlay on white).\n" +
    "- funnelStage: the buyer intent the visual signals - TOF (awareness/lifestyle/problem), MOF (consideration/benefit/demo), or BOF (offer/discount/urgency/direct product).\n" +
    "Judge only what is visible. Never invent detail you cannot see.";
  const out = await callGemini(prompt, VISUAL_SCHEMA, inline);
  if (!out) return null;
  const sem = { sceneType: str(out.sceneType), setting: str(out.setting), palette: str(out.palette), visualMood: str(out.visualMood), contentSubject: str(out.contentSubject), funnelStage: str(out.funnelStage) };
  return sem.sceneType || sem.setting || sem.palette || sem.visualMood || sem.contentSubject || sem.funnelStage ? sem : null;
}

// Decode up to `max` creatives that lack a VISUAL read + persist them (fingerprint-once). Upserts only the
// visual columns, so a prior copy decode on the same content_hash is preserved. Fire-and-forget; never throws.
export async function decodeMissingVisual(userId: string, items: { contentHash: string; asset: CreativeAsset }[], haveVisual: Set<string>, max = 10): Promise<void> {
  // Short-circuit the whole batch once when AI is killed or over daily budget, so we don't pay N flag/usage
  // reads in the loop (each decodeCreativeVisual re-checks too, as defense-in-depth for any direct caller).
  if (await isKilled("ai") || await aiBudgetExceeded()) return;
  const admin = createAdminClient();
  const seen = new Set<string>();
  let done = 0;
  for (const it of items) {
    if (done >= max) break;
    if (!it.contentHash || haveVisual.has(it.contentHash) || seen.has(it.contentHash)) continue;
    seen.add(it.contentHash);
    try {
      const sem = await decodeCreativeVisual(it.asset);
      if (!sem) continue;
      await admin
        .from("creative_semantics")
        .upsert({ user_id: userId, content_hash: it.contentHash, scene_type: sem.sceneType, setting: sem.setting, palette: sem.palette, visual_mood: sem.visualMood, content_subject: sem.contentSubject, funnel_stage: sem.funnelStage, visual_model: "gemini", updated_at: new Date().toISOString() }, { onConflict: "user_id,content_hash" })
        .then(undefined, () => {});
      done++;
    } catch {
      /* one creative's visual decode failing must not stop the rest */
    }
  }
}
