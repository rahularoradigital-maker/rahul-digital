import type { createAdminClient } from "@/lib/supabase/admin";
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
  const rows = ads.map((a) => ({
    user_id: userId, account_external_id: accountId, page_id: a.pageId, ad_archive_id: a.adArchiveId,
    is_my_brand: isMyBrand, brand_label: a.brandLabel, is_active: a.isActive, display_format: a.displayFormat,
    media: a.media, cta_text: a.ctaText, cta_type: a.ctaType, title: a.title, body: a.body, link_url: a.linkUrl,
    platforms: a.platforms, start_date: a.startDate, end_date: a.endDate, card_count: a.cardCount, ad_url: a.adUrl,
    image_url: a.imageUrl, video_url: a.videoUrl, video_thumb_url: a.videoThumbUrl,
  }));

  // NON-DESTRUCTIVE refresh (ISSUE 02): write the new set FIRST and verify it, then delete only the
  // rows it replaced. The old delete-then-write order meant a failed/partial write left the brand with
  // NO data. If either upsert errors we throw BEFORE deleting anything, so last-known-good survives and
  // the caller reports this brand as failed.
  const [adsRes, brandRes] = await Promise.all([
    rows.length > 0
      ? admin.from("competitor_ads").upsert(rows, { onConflict: "user_id,account_external_id,page_id,ad_archive_id" })
      : Promise.resolve({ error: null }),
    admin.from("competitor_brands").upsert(
      { user_id: userId, account_external_id: accountId, page_id: pageId, label, is_my_brand: isMyBrand, ad_library_url: adLibraryUrl, ad_count: ads.length, updated_at: new Date().toISOString() },
      { onConflict: "user_id,account_external_id,page_id" },
    ),
  ]);
  if (adsRes?.error || brandRes?.error) {
    throw new Error(`competitor write failed for page ${pageId}: ${adsRes?.error?.message ?? brandRes?.error?.message}`);
  }

  // New set is safely stored -> remove this account's OLD ads for this page that are no longer live.
  // Only when the new set is non-empty: an empty pull is treated as "nothing to promote" (a genuine or
  // spurious zero), so we keep last-known-good rather than wiping the brand. Best-effort: a delete miss
  // just leaves a few stale rows, it never loses the new data.
  if (rows.length > 0) {
    const keepIds = ads.map((a) => a.adArchiveId).join(","); // Facebook archive ids are all-digit
    const del = admin.from("competitor_ads").delete().eq("user_id", userId).eq("page_id", pageId).not("ad_archive_id", "in", `(${keepIds})`);
    await (accountId === null ? del.is("account_external_id", null) : del.eq("account_external_id", accountId)).then(undefined, (e) => console.error("[competitors/store] stale-ad cleanup failed (recoverable; new data already written)", e));
  }
}
