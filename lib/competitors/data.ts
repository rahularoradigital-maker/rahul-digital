import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReport, buildCreativeIntel, buildRecommendations, type CreativeIntel, type CreativeRecommendation } from "./analytics.ts";
import type { AnalyzedCreative, CompetitorReport, CreativeAttributes, MediaCategory, NormalizedAd } from "./types.ts";

// Reads the stored competitor ads for a user (written by /api/competitors/run) and runs
// the analytics engine. Returns null when nothing has been collected yet, so the UI shows
// the input + pipeline instead of an empty dashboard. Service-role read scoped by user_id,
// matching the rest of the app; never throws (a DB hiccup returns null).

export type CompetitorData = {
  report: CompetitorReport;
  brandCount: number;
  adCount: number;
  updatedAt: string | null;
  creativeIntel: CreativeIntel | null; // null until Gemini stage 7 has analyzed some creatives
  recommendations: CreativeRecommendation[]; // deterministic "next creatives to test" (no LLM)
};

type AdRow = {
  page_id: string;
  ad_archive_id: string;
  is_my_brand: boolean;
  brand_label: string | null;
  is_active: boolean | null;
  display_format: string | null;
  media: string | null;
  cta_text: string | null;
  cta_type: string | null;
  title: string | null;
  body: string | null;
  link_url: string | null;
  platforms: string[] | null;
  start_date: number | null;
  end_date: number | null;
  card_count: number | null;
  ad_url: string | null;
  image_url: string | null;
  video_url: string | null;
  video_thumb_url: string | null;
};

function toNormalized(r: AdRow): NormalizedAd {
  const media = (r.media ?? "other") as MediaCategory;
  return {
    pageId: r.page_id,
    adArchiveId: r.ad_archive_id,
    brandLabel: r.brand_label ?? "Unknown",
    isMyBrand: r.is_my_brand,
    isActive: r.is_active ?? false,
    displayFormat: r.display_format ?? "",
    media,
    ctaText: r.cta_text,
    ctaType: r.cta_type,
    title: r.title,
    body: r.body,
    linkUrl: r.link_url,
    platforms: Array.isArray(r.platforms) ? r.platforms : [],
    startDate: r.start_date,
    endDate: r.end_date,
    cardCount: r.card_count ?? 0,
    adUrl: r.ad_url,
    imageUrl: r.image_url,
    videoUrl: r.video_url,
    videoThumbUrl: r.video_thumb_url,
  };
}

export async function loadCompetitorData(userId: string, accountId: string | null): Promise<CompetitorData | null> {
  try {
    const admin = createAdminClient();
    // Scope to the ACTIVE account so each account shows its own competitors (not another
    // account's). Rows added before this feature have account_external_id = NULL; they only
    // surface when no account is active, so switching to a real account correctly starts fresh.
    const adsQuery = admin
      .from("competitor_ads")
      .select(
        "page_id, ad_archive_id, is_my_brand, brand_label, is_active, display_format, media, cta_text, cta_type, title, body, link_url, platforms, start_date, end_date, card_count, ad_url, image_url, video_url, video_thumb_url",
      )
      .eq("user_id", userId);
    const { data: ads } = await (accountId === null ? adsQuery.is("account_external_id", null) : adsQuery.eq("account_external_id", accountId));
    if (!ads || ads.length === 0) return null;

    const brandsQuery = admin.from("competitor_brands").select("updated_at").eq("user_id", userId);
    const { data: brands } = await (accountId === null ? brandsQuery.is("account_external_id", null) : brandsQuery.eq("account_external_id", accountId))
      .order("updated_at", { ascending: false })
      .limit(1);

    const normalized = (ads as AdRow[]).map(toNormalized);
    const report = buildReport(normalized, Math.floor(Date.now() / 1000));
    const brandCount = (report.myBrand ? 1 : 0) + report.competitors.length;

    // Stage 7 output, if any creatives have been analyzed.
    const { data: analysisRows } = await admin
      .from("competitor_creative_analysis")
      .select("page_id, ad_archive_id, is_my_brand, brand_label, attributes")
      .eq("user_id", userId);
    // Only keep analysis for ads that belong to THIS account's competitor set (the analysis table
    // is keyed by content/ad_archive_id and shared across accounts; scope it via the account's ads).
    const accountAdIds = new Set(normalized.map((a) => a.adArchiveId));
    const analyzed: AnalyzedCreative[] = ((analysisRows as AnalysisRow[] | null) ?? [])
      .filter((r) => accountAdIds.has(r.ad_archive_id))
      .map((r) => ({
        adArchiveId: r.ad_archive_id,
        pageId: r.page_id,
        brandLabel: r.brand_label ?? "Unknown",
        isMyBrand: r.is_my_brand,
        attributes: (r.attributes ?? {}) as CreativeAttributes,
      }));

    return {
      report,
      brandCount,
      adCount: normalized.length,
      updatedAt: brands?.[0]?.updated_at ?? null,
      creativeIntel: analyzed.length > 0 ? buildCreativeIntel(analyzed) : null,
      recommendations: buildRecommendations(report),
    };
  } catch {
    return null;
  }
}

type AnalysisRow = {
  page_id: string;
  ad_archive_id: string;
  is_my_brand: boolean;
  brand_label: string | null;
  attributes: CreativeAttributes | null;
};
