// Pure helpers for deep creative analysis, extracted so a node check can exercise them WITHOUT the
// server-only DB / Meta / Gemini modules. No I/O here - just the validity, entitlement, and manifest logic.

export const MAX_CREATIVES = 10;
export const FREE_RUNS = 1;

export type DeepRead = {
  sceneType: string | null;
  setting: string | null;
  palette: string | null;
  visualMood: string | null;
  contentSubject: string | null;
  funnelStage: string | null;
  motionSummary: string | null; // video only: what CHANGES across the video; null for a still image
};

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
  analyzed: boolean; // false = selected but could not be read (never fabricated)
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

// Turn a raw model output into a DeepRead. Returns null when nothing readable came back (so a read is
// never fabricated). motionSummary is kept only for videos (allowMotion) - an image never claims motion.
export function parseDeepRead(out: Record<string, unknown> | null, allowMotion: boolean): DeepRead | null {
  if (!out) return null;
  const r: DeepRead = {
    sceneType: str(out.sceneType),
    setting: str(out.setting),
    palette: str(out.palette),
    visualMood: str(out.visualMood),
    contentSubject: str(out.contentSubject),
    funnelStage: str(out.funnelStage),
    motionSummary: allowMotion ? str(out.motionSummary) : null,
  };
  return r.sceneType || r.setting || r.palette || r.visualMood || r.contentSubject || r.funnelStage ? r : null;
}

// Server-authoritative entitlement: the free plan allows FREE_RUNS run(s).
export function hasUsedFreeRun(runs: number): boolean {
  return runs >= FREE_RUNS;
}

// DB row (deep_creative_read) -> the manifest the UI shows. analyzed=true only when a model actually read it.
export function rowToManifest(r: Record<string, unknown>): DeepCreativeRow {
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
