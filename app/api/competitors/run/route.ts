import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchBrandAds, pageIdFromAdLibraryUrl } from "@/lib/scrapecreators";
import type { NormalizedAd } from "@/lib/competitors/types";

// Stage 2 + 3 of the competitor pipeline: given the user's brand + competitor Ad Library
// URLs, pull every live ad via ScrapeCreators, normalize, and store per-user. Delete-then-
// insert per brand so a re-run reflects the current live set (no stale ads linger). Nothing
// is fabricated: a URL with no page id, or a brand the API cannot fetch, is reported as an
// error, and only real returned ads are stored.

export const maxDuration = 60; // ScrapeCreators paginates a few pages per brand.

type Body = { brandUrl?: string; competitors?: string[] };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  // (url, isMyBrand) targets: the brand first, then each competitor.
  const targets: { url: string; isMyBrand: boolean }[] = [];
  if (body.brandUrl?.trim()) targets.push({ url: body.brandUrl.trim(), isMyBrand: true });
  for (const c of body.competitors ?? []) {
    if (c?.trim()) targets.push({ url: c.trim(), isMyBrand: false });
  }
  if (targets.length === 0) {
    return NextResponse.json({ ok: false, error: "Add your brand URL and at least one competitor." }, { status: 400 });
  }

  const admin = createAdminClient();
  const brands: { label: string; pageId: string; adCount: number; isMyBrand: boolean }[] = [];
  const errors: string[] = [];

  for (const t of targets) {
    const pageId = pageIdFromAdLibraryUrl(t.url);
    if (!pageId) {
      errors.push(`Not a Facebook Ad Library URL: ${t.url}`);
      continue;
    }
    let ads: NormalizedAd[];
    try {
      ads = await fetchBrandAds(pageId, t.isMyBrand ? "My brand" : "Competitor", t.isMyBrand);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `Failed to fetch ${pageId}`);
      continue;
    }
    const label = ads[0]?.brandLabel ?? (t.isMyBrand ? "My brand" : `Page ${pageId}`);

    // Refresh this brand's ads: clear the old set, then insert the live one.
    await admin.from("competitor_ads").delete().eq("user_id", user.id).eq("page_id", pageId);
    if (ads.length > 0) {
      const rows = ads.map((a) => ({
        user_id: user.id,
        page_id: a.pageId,
        ad_archive_id: a.adArchiveId,
        is_my_brand: a.isMyBrand,
        brand_label: a.brandLabel,
        is_active: a.isActive,
        display_format: a.displayFormat,
        media: a.media,
        cta_text: a.ctaText,
        cta_type: a.ctaType,
        title: a.title,
        body: a.body,
        link_url: a.linkUrl,
        platforms: a.platforms,
        start_date: a.startDate,
        end_date: a.endDate,
        card_count: a.cardCount,
        ad_url: a.adUrl,
      }));
      await admin.from("competitor_ads").upsert(rows, { onConflict: "user_id,page_id,ad_archive_id" });
    }
    await admin.from("competitor_brands").upsert(
      { user_id: user.id, page_id: pageId, label, is_my_brand: t.isMyBrand, ad_library_url: t.url, ad_count: ads.length, updated_at: new Date().toISOString() },
      { onConflict: "user_id,page_id" },
    );
    brands.push({ label, pageId, adCount: ads.length, isMyBrand: t.isMyBrand });
  }

  const ok = brands.length > 0;
  return NextResponse.json({ ok, brands, errors }, { status: ok ? 200 : 502 });
}
