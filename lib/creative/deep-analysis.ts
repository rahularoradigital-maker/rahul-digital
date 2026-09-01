import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readToken } from "@/lib/oauth-store";
import { listTopSpendingAds, fetchAdCreatives } from "@/lib/meta-source";
import { deepReadVideo, deepReadImage, type DeepRead } from "@/lib/creative/deep-decode";

// Deep creative analysis (free-plan trial): read the TOP-SPENDING creatives in depth - real video motion
// for videos, full image read for images. Strictly bounded: FREE_RUNS run(s), MAX_CREATIVES creatives, top
// spenders only. The entitlement is server-authoritative (a DB row per run), so it cannot be looped from the
// client. Every read degrades to null on failure and is recorded honestly (model=null = "could not read").

export const MAX_CREATIVES = 10;
export const FREE_RUNS = 1;
const WINDOW_DAYS = 90;

export type DeepCreativeRow = {
  contentHash: string;
  adId: string | null;
  adName: string | null;
  format: string | null; // 'video' | 'image'
  spendRs: number | null;
  sceneType: string | null;
  setting: string | null;
  palette: string | null;
  visualMood: string | null;
  contentSubject: string | null;
  motionSummary: string | null;
  analyzed: boolean; // false = we selected it but could not read it (never fabricated)
};

export type DeepAnalysisStatus = { used: boolean; runs: number; freeRuns: number; maxCreatives: number; reads: DeepCreativeRow[] };

type MetaRow = { ad_id: string; content_hash: string | null; format: string | null };

function rowToManifest(r: Record<string, unknown>): DeepCreativeRow {
  return {
    contentHash: String(r.content_hash ?? ""),
    adId: (r.ad_id as string) ?? null,
    adName: (r.ad_name as string) ?? null,
    format: (r.format as string) ?? null,
    spendRs: r.spend_rs === null || r.spend_rs === undefined ? null : Number(r.spend_rs),
    sceneType: (r.scene_type as string) ?? null,
    setting: (r.setting as string) ?? null,
    palette: (r.palette as string) ?? null,
    visualMood: (r.visual_mood as string) ?? null,
    contentSubject: (r.content_subject as string) ?? null,
    motionSummary: (r.motion_summary as string) ?? null,
    analyzed: Boolean(r.model),
  };
}

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
    }
    reads.push(row);
  }

  // Record the run (this consumes the free entitlement) with the count actually read.
  const analyzed = reads.filter((r) => r.analyzed).length;
  await admin.from("deep_analysis_run").insert({ user_id: userId, account_external_id: accountExternalId, creatives_analyzed: analyzed }).then(undefined, () => {});
  return { ok: true, reads };
}
