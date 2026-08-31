import "server-only";
import { createAdminClient } from "../supabase/admin.ts";
import { runTaskJson } from "../ai/router.ts";
import { compose } from "../ai/compose.ts";
import type { CreativeAsset } from "./fingerprint.ts";

// Semantic creative decode - the layer that turns each ad's copy into the dimensions the diversity engine
// reads beyond the free `format`: funnel stage, hook, emotion, subject. FINGERPRINT-ONCE: keyed by
// content_hash so each unique creative is decoded by the model exactly once and reused forever (the cost
// control). Copy-based (headline/body/CTA carry most of the signal) - cheaper than vision and no image fetch.
// Everything degrades gracefully to nulls, in which case the diversity engine simply reads on `format` alone
// (its prior behaviour) - so this can never break the cockpit. Untrusted ad copy is fenced (compose).

export type CreativeSemantics = { funnelStage: string | null; hookType: string | null; emotion: string | null; subject: string | null };

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
    const { data } = await admin.from("creative_semantics").select("content_hash,funnel_stage,hook_type,emotion,subject").eq("user_id", userId).in("content_hash", hashes);
    for (const r of (data ?? []) as { content_hash: string; funnel_stage: string | null; hook_type: string | null; emotion: string | null; subject: string | null }[]) {
      out.set(r.content_hash, { funnelStage: r.funnel_stage, hookType: r.hook_type, emotion: r.emotion, subject: r.subject });
    }
  } catch {
    /* cache unavailable -> empty -> diversity reads on format alone */
  }
  return out;
}

/** Decode ONE creative's copy into its four semantic dimensions, or null when there is nothing to read. */
export async function decodeCreativeCopy(asset: CreativeAsset): Promise<CreativeSemantics | null> {
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
