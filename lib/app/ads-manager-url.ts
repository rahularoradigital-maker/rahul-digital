// Deep link into the account's Meta Ads Manager, opened at one specific ad, so any AI
// suggestion can be checked against the live ad. Ids are bare numbers: external_id has
// no "act_" prefix, and the ad id is the Meta ad id (CockpitAd.id). Returns null when
// either id is missing, so callers render plain text instead of a broken link.
export function adsManagerUrl(accountId: string | undefined, adId: string | undefined): string | null {
  if (!accountId || !adId) return null;
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${encodeURIComponent(accountId)}&selected_ad_ids=${encodeURIComponent(adId)}`;
}
