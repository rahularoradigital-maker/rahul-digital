import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readToken } from "@/lib/oauth-store";
import { listTopSpendingAds, fetchAdCreatives } from "@/lib/meta-source";
import { deepReadVideo, deepReadImage } from "@/lib/creative/deep-decode";
import { MAX_CREATIVES, FREE_RUNS, rowToManifest, type DeepCreativeRow, type DeepRead } from "@/lib/creative/deep-analysis-pure";

// Deep creative analysis (free-plan trial): read the TOP-SPENDING creatives in depth - real video motion
// for videos, full image read for images. Strictly bounded: FREE_RUNS run(s), MAX_CREATIVES creatives, top
// spenders only. The entitlement is server-authoritative (a DB row per run), so it cannot be looped from the
// client. Every read degrades to null on failure and is recorded honestly (model=null = "could not read").
// Pure helpers/types live in ./deep-analysis-pure (so a node check can exercise them without this module's I/O).

export { MAX_CREATIVES, FREE_RUNS } from "@/lib/creative/deep-analysis-pure";
export type { DeepCreativeRow } from "@/lib/creative/deep-analysis-pure";

const WINDOW_DAYS = 90;

export type DeepAnalysisStatus = { used: boolean; runs: number; freeRuns: number; maxCreatives: number; reads: DeepCreativeRow[] };

type MetaRow = { ad_id: string; content_hash: string | null; format: string | null };

// Has the free user used their run? + the manifest of exactly what was analysed (transparency).
export async function getDeepAnalysisStatus(userId: string): Promise<DeepAnalysisStatus> {
  const admin = createAdminClient();
  const [runRes, readRes] = await Promise.all([
    admin.from("deep_analysis_run").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("deep_creative_read").select("*").eq("user_id", userId).order("spend_rs", { ascending: false, nullsFirst: false }).limit(MAX_CREATIVES),
  ]);
  const runs = runRes.count ?? 0;
  return { used: runs >= FREE_RUNS, runs, freeRuns: FREE_RUNS, maxCreatives: MAX_CREATIVES, reads: (readRes.data ?? []).map(rowToManifest) };
}

async function readMetaRows(admin: ReturnType<typeof createAdminClient>, userId: string, account: string, adIds: string[]): Promise<Map<string, MetaRow>> {
  const { data } = await admin.from("ad_meta").select("ad_id,content_hash,format").eq("user_id", userId).eq("account_external_id", account).in("ad_id", adIds);
  const m = new Map<string, MetaRow>();
  for (const r of (data ?? []) as MetaRow[]) m.set(r.ad_id, r);
  return m;
}

async function readSpendByAd(admin: ReturnType<typeof createAdminClient>, userId: string, account: string, adIds: string[], since: string): Promise<Map<string, number>> {
  const { data } = await admin.from("ad_metrics").select("ad_id,spend").eq("user_id", userId).eq("account_external_id", account).in("ad_id", adIds).gte("date", since);
  const m = new Map<string, number>();
  for (const r of (data ?? []) as { ad_id: string; spend: number | null }[]) m.set(r.ad_id, (m.get(r.ad_id) ?? 0) + Number(r.spend ?? 0));
  return m;
}

// Run the one-time deep analysis for the free user's TOP-10 spenders. Server-authoritative entitlement.
export async function runDeepAnalysis(userId: string, accountExternalId: string): Promise<{ ok: boolean; reason?: string; reads: DeepCreativeRow[] }> {
  const admin = createAdminClient();

  // Entitlement gate FIRST (before any spend): free plan = FREE_RUNS.
  const { count } = await admin.from("deep_analysis_run").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= FREE_RUNS) return { ok: false, reason: "used", reads: (await getDeepAnalysisStatus(userId)).reads };

  const token = await readToken(accountExternalId, userId); // null unless THIS user owns the account (tenant guard)
  if (!token) return { ok: false, reason: "not_connected", reads: [] };

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const top = await listTopSpendingAds(accountExternalId, since, token, undefined, MAX_CREATIVES);
  if (top.length === 0) return { ok: false, reason: "no_ads", reads: [] };
  const adIds = top.map((a) => a.externalId);

  const [assets, meta, spendById] = await Promise.all([
    fetchAdCreatives(accountExternalId, adIds, token),
    readMetaRows(admin, userId, accountExternalId, adIds),
    readSpendByAd(admin, userId, accountExternalId, adIds, since),
  ]);

  const reads: DeepCreativeRow[] = [];
  for (const ref of top) {
    const asset = assets.get(ref.externalId);
    const m = meta.get(ref.externalId);
    const contentHash = m?.content_hash || `ad:${ref.externalId}`;
    const isVideo = Boolean(asset?.videoId) || Boolean(asset?.isVideo);
    // Video -> real motion read; else the real image (or the video thumbnail as a last resort).
    let read: DeepRead | null = null;
    if (asset?.videoId) read = await deepReadVideo(asset.videoId, token.accessToken);
    if (!read) {
      const url = asset?.imageUrl || asset?.videoThumbUrl || null;
      if (url) read = await deepReadImage(url);
    }
    const row: DeepCreativeRow = {
      contentHash,
      adId: ref.externalId,
      adName: ref.name,
      format: isVideo ? "video" : (m?.format ?? "image"),
      spendRs: spendById.has(ref.externalId) ? Math.round(spendById.get(ref.externalId)!) : null,
      sceneType: read?.sceneType ?? null,
      setting: read?.setting ?? null,
      palette: read?.palette ?? null,
      visualMood: read?.visualMood ?? null,
      contentSubject: read?.contentSubject ?? null,
      motionSummary: read?.motionSummary ?? null,
      analyzed: Boolean(read),
    };
    if (read) {
      await admin
        .from("deep_creative_read")
        .upsert(
          { user_id: userId, content_hash: contentHash, ad_id: row.adId, ad_name: row.adName, format: row.format, spend_rs: row.spendRs, scene_type: row.sceneType, setting: row.setting, palette: row.palette, visual_mood: row.visualMood, content_subject: row.contentSubject, motion_summary: row.motionSummary, model: "gemini" },
          { onConflict: "user_id,content_hash" },
        )
        .then(undefined, () => {});
      // Upgrade the SHARED Creative DNA cache so the normal DNA view reflects this richer (video-motion)
      // read. The cover-frame pipeline skips any content_hash that already has a visual read, so this
      // deep read persists and is not overwritten by a later shallow pass.
      await admin
        .from("creative_semantics")
        .upsert(
          { user_id: userId, content_hash: contentHash, scene_type: read.sceneType, setting: read.setting, palette: read.palette, visual_mood: read.visualMood, content_subject: read.contentSubject, funnel_stage: read.funnelStage, visual_model: "gemini-deep", updated_at: new Date().toISOString() },
          { onConflict: "user_id,content_hash" },
        )
        .then(undefined, () => {});
    }
    reads.push(row);
  }

  // Record the run (this consumes the free entitlement) with the count actually read.
  const analyzed = reads.filter((r) => r.analyzed).length;
  await admin.from("deep_analysis_run").insert({ user_id: userId, account_external_id: accountExternalId, creatives_analyzed: analyzed }).then(undefined, () => {});
  return { ok: true, reads };
}
