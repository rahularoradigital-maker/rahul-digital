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

export type DeepInsight = { line: string; patterns: { dimension: string; label: string; count: number }[] };

// Deterministic synthesis of the deep reads into one honest, plain-English line (no AI): the dominant
// scene + mood among the analysed top-spenders, and how many were read as real video motion. Returns null
// when fewer than 2 creatives were actually read - too few to call a pattern (never overclaims).
export function summariseDeepReads(reads: DeepCreativeRow[]): DeepInsight | null {
  const analyzed = reads.filter((r) => r.analyzed);
  if (analyzed.length < 2) return null;
  const videos = analyzed.filter((r) => r.format === "video").length;
  const top = (pick: (r: DeepCreativeRow) => string | null, dimension: string) => {
    const counts = new Map<string, number>();
    for (const r of analyzed) {
      const v = pick(r);
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return best ? { dimension, label: best[0], count: best[1] } : null;
  };
  const scene = top((r) => r.sceneType, "scene");
  const mood = top((r) => r.visualMood, "mood");
  const patterns = [scene, mood].filter((p): p is NonNullable<typeof p> => p !== null);
  const parts: string[] = [];
  if (scene) parts.push(`${scene.count} of your top ${analyzed.length} lean ${scene.label}`);
  if (mood) parts.push(`the mood is mostly ${mood.label}`);
  const videoNote = videos > 0 ? ` ${videos} read as real video motion.` : "";
  const line = parts.length ? `${parts.join("; ")}.${videoNote}` : `Read ${analyzed.length} of your top spenders.${videoNote}`;
  return { line, patterns };
}

// A grounded "test next" nudge (no AI): if the analysed top-spenders are concentrated in ONE scene type,
// that spend is fragile (one look fatigues -> most spend exposed). Returns null when there are too few reads
// or the mix is already varied enough - never invents a specific creative to make.
export function deepDiversityNudge(reads: DeepCreativeRow[]): string | null {
  const analyzed = reads.filter((r) => r.analyzed && r.sceneType);
  if (analyzed.length < 3) return null;
  const counts = new Map<string, number>();
  for (const r of analyzed) counts.set(r.sceneType!, (counts.get(r.sceneType!) ?? 0) + 1);
  const [topScene, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCount / analyzed.length < 0.7) return null; // already varied enough
  return `Your top spenders are concentrated in one look - "${topScene}" (${topCount} of ${analyzed.length}). That is fragile: if it fatigues, most of your spend is exposed at once. Test a different scene type before it does.`;
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
