import { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedAd } from "./types";

type Admin = ReturnType<typeof createAdminClient>;

// The ONE writer for a competitor brand's live ad set. Both the manual competitor run and the
// auto-discovery route call this so the account-scoped conflict keys can never drift apart (that
// drift is exactly what ISSUE 01 warned about). Every write is scoped to (user, account): the same
// page/ad in two different Meta accounts is two rows, and switching accounts never overwrites the
// other account's competitor data. account_external_id is nullable, so the unique indexes are
// NULLS NOT DISTINCT - a no-account (null) scan still dedupes against its own earlier rows.
export async function storeCompetitorBrandAds(
  admin: Admin,
  args: { userId: string; accountId: string | null; pageId: string; isMyBrand: boolean; label: string; adLibraryUrl: string; ads: NormalizedAd[] },
): Promise<void> {
  const { userId, accountId, pageId, isMyBrand, label, adLibraryUrl, ads } = args;
  // Clear this brand's old ads for THIS account first, then write the live set + the brand row.
  const del = admin.from("competitor_ads").delete().eq("user_id", userId).eq("page_id", pageId);
  await (accountId === null ? del.is("account_external_id", null) : del.eq("account_external_id", accountId));
  const rows = ads.map((a) => ({
    user_id: userId, account_external_id: accountId, page_id: a.pageId, ad_archive_id: a.adArchiveId,
    is_my_brand: isMyBrand, brand_label: a.brandLabel, is_active: a.isActive, display_format: a.displayFormat,
    media: a.media, cta_text: a.ctaText, cta_type: a.ctaType, title: a.title, body: a.body, link_url: a.linkUrl,
    platforms: a.platforms, start_date: a.startDate, end_date: a.endDate, card_count: a.cardCount, ad_url: a.adUrl,
    image_url: a.imageUrl, video_url: a.videoUrl, video_thumb_url: a.videoThumbUrl,
  }));
  await Promise.all([
    rows.length > 0 ? admin.from("competitor_ads").upsert(rows, { onConflict: "user_id,account_external_id,page_id,ad_archive_id" }) : Promise.resolve(),
    admin.from("competitor_brands").upsert(
      { user_id: userId, account_external_id: accountId, page_id: pageId, label, is_my_brand: isMyBrand, ad_library_url: adLibraryUrl, ad_count: ads.length, updated_at: new Date().toISOString() },
      { onConflict: "user_id,account_external_id,page_id" },
    ),
  ]);
}
