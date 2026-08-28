import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserMetaSession } from "@/lib/meta-sync";
import { analyzeCreative } from "@/lib/agents/creative/orchestrator";
import { probeGemini, GEMINI_MODEL } from "@/lib/gemini";
import type { CreativeAttributes } from "@/lib/competitors/types";

// Stage 7 (LLM Creative Analysis): pick the top N creatives per brand and have Gemini read
// each one, writing the 42-attribute set + TOF/MOF/BOF into competitor_creative_analysis.
// Idempotent + cheap to resume: already-analyzed ads are skipped, and each request is capped
// so it finishes inside the serverless window; the client can run it again to continue.

export const maxDuration = 60;

const REQUEST_CAP = 40; // max creatives analyzed per call (resume by calling again)
// Per-user DAILY cost cap: each creative fans out to ~6 Gemini vision calls, and the client can
// re-invoke ("Continue"). Without a ceiling one user could drive an unbounded bill. This caps the
// creatives one user can analyze in a rolling 24h window; over the cap the route does no Gemini
// work at all. calibrate-at-build.
const DAILY_CREATIVE_CAP = 300;
// Each creative fans out to ~6 specialist agents, so keep the outer concurrency low: 2
// creatives x 6 agents = 12 concurrent Gemini calls, which stays under typical rate limits.
const CONCURRENCY = 2;

type Body = { perBrand?: number };

type AdRow = {
  page_id: string;
  ad_archive_id: string;
  is_my_brand: boolean;
  brand_label: string | null;
  is_active: boolean | null;
  start_date: number | null;
  title: string | null;
  body: string | null;
  cta_text: string | null;
  image_url: string | null;
  video_url: string | null;
  video_thumb_url: string | null;
};

// Top N per brand: active first, then most recent.
function topPerBrand(ads: AdRow[], n: number): AdRow[] {
  const byBrand = new Map<string, AdRow[]>();
  for (const a of ads) {
    const list = byBrand.get(a.page_id) ?? [];
    list.push(a);
    byBrand.set(a.page_id, list);
  }
  const out: AdRow[] = [];
  for (const list of byBrand.values()) {
    list.sort((x, y) => Number(y.is_active) - Number(x.is_active) || (y.start_date ?? 0) - (x.start_date ?? 0));
    out.push(...list.slice(0, n));
  }
  return out;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const userId = user.id;

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ ok: false, error: "GEMINI_API_KEY is not set. Add it in Vercel to enable AI analysis." }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }
  const perBrand = Math.max(1, Math.min(200, Math.floor(body.perBrand ?? 20)));

  // Scope WHICH ads we analyze to the active account's competitor set (matches what the Market page
  // shows), so we never analyze another account's ads. The daily cap itself is per-USER and shared
  // across all of that user's accounts on purpose - it is a cost control, so one user cannot multiply
  // Gemini spend by switching accounts.
  const session = await getUserMetaSession(userId);
  const accountId = session?.activeExternalId ?? null;
  const admin = createAdminClient();
  const adsBase = admin
    .from("competitor_ads")
    .select("page_id, ad_archive_id, is_my_brand, brand_label, is_active, start_date, title, body, cta_text, image_url, video_url, video_thumb_url")
    .eq("user_id", userId);
  const { data: adsRaw } = await (accountId === null ? adsBase.is("account_external_id", null) : adsBase.eq("account_external_id", accountId));
  const ads = (adsRaw as AdRow[] | null) ?? [];
  if (ads.length === 0) return NextResponse.json({ ok: false, error: "No competitor ads yet. Run the pull first." }, { status: 400 });

  // Two independent reads (already-analyzed set + rolling-24h usage count), both keyed on userId
  // only, so run them concurrently instead of in series. The cap is enforced BEFORE spending any
  // Gemini tokens; on a count-failure we treat usage as 0 (REQUEST_CAP still bounds the request).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [doneRes, usedRes] = await Promise.all([
    admin.from("competitor_creative_analysis").select("ad_archive_id").eq("user_id", userId),
    admin.from("competitor_creative_analysis").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("analyzed_at", since),
  ]);
  const analyzed = new Set((doneRes.data ?? []).map((d: { ad_archive_id: string }) => d.ad_archive_id));
  const selected = topPerBrand(ads, perBrand).filter((a) => !analyzed.has(a.ad_archive_id));
  const dailyRemaining = Math.max(0, DAILY_CREATIVE_CAP - (usedRes.count ?? 0));
  if (dailyRemaining === 0) {
    return NextResponse.json({
      ok: true,
      analyzed: 0,
      failed: 0,
      remaining: selected.length,
      dailyCapReached: true,
      message: `Daily analysis limit (${DAILY_CREATIVE_CAP} creatives across your accounts) reached. It resets on a rolling 24-hour basis.`,
    });
  }

  const queue = selected.slice(0, Math.min(REQUEST_CAP, dailyRemaining));
  const remaining = selected.length - queue.length;

  // GLOBAL REUSE: an ad_archive_id is a stable global id for that exact creative, so if ANY user
  // has already analyzed it we copy that result instead of paying Gemini again. This collapses the
  // per-user cost when many users track the same popular competitors (the audit's #1 cost lever).
  const queueIds = queue.map((a) => a.ad_archive_id);
  const globalCache = new Map<string, CreativeAttributes>();
  if (queueIds.length > 0) {
    const { data: globalRows } = await admin
      .from("competitor_creative_analysis")
      .select("ad_archive_id, attributes")
      .in("ad_archive_id", queueIds);
    for (const r of (globalRows ?? []) as { ad_archive_id: string; attributes: CreativeAttributes | null }[]) {
      if (r.attributes && !globalCache.has(r.ad_archive_id)) globalCache.set(r.ad_archive_id, r.attributes);
    }
  }

  let ok = 0;
  let failed = 0;
  let reused = 0;
  // Bounded concurrency: CONCURRENCY workers draining a shared index.
  let idx = 0;
  async function worker() {
    while (idx < queue.length) {
      const a = queue[idx++];
      // Reuse a global result if one exists for this exact creative; only call Gemini otherwise.
      const cached = globalCache.get(a.ad_archive_id);
      let attrs: CreativeAttributes | null;
      if (cached) {
        attrs = cached;
      } else {
        try {
          attrs = await analyzeCreative({
            imageUrl: a.image_url,
            videoThumbUrl: a.video_thumb_url,
            title: a.title,
            body: a.body,
            ctaText: a.cta_text,
            isVideo: Boolean(a.video_url),
          });
        } catch {
          // A thrown error (rate limit, network) must count as a failed creative, not reject
          // Promise.all and 500 the whole request.
          attrs = null;
        }
      }
      if (!attrs) {
        failed++;
        continue;
      }
      const { error } = await admin.from("competitor_creative_analysis").upsert(
        {
          user_id: userId,
          page_id: a.page_id,
          ad_archive_id: a.ad_archive_id,
          is_my_brand: a.is_my_brand,
          brand_label: a.brand_label,
          funnel_stage: attrs.funnelStage,
          hook: attrs.hook,
          hook_type: attrs.hookType,
          primary_emotion: attrs.primaryEmotion,
          offer: attrs.offer,
          attributes: attrs,
          model: GEMINI_MODEL,
          analyzed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,ad_archive_id" },
      );
      if (error) failed++;
      else if (cached) reused++; // copied from a global result, no Gemini spend
      else ok++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

  // If everything failed, surface the real Gemini error (status + snippet) instead of a
  // silent "0 analyzed", so the cause is confirmed, not guessed.
  const diag = ok === 0 && failed > 0 ? await probeGemini() : undefined;

  // analyzed = newly Gemini-analyzed; reused = copied from a global result (no spend).
  return NextResponse.json({ ok: true, analyzed: ok, reused, failed, remaining, diag });
}
