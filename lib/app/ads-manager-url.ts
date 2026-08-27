// Deep link into the account's Meta Ads Manager, filtered and opened at one specific ad,
// so any AI suggestion can be checked against the live ad over the same date window the
// user is looking at in AdBrain. Ids are bare numbers: external_id has no "act_" prefix,
// and the ad id is the Meta ad id (CockpitAd.id). The filter_set narrows the table to the
// single ad; selected_ad_ids opens it selected; dateParam ("YYYY-MM-DD_YYYY-MM-DD") carries
// the window. Returns null when either id is missing, so callers render plain text instead
// of a broken link.
export function adsManagerUrl(accountId: string | undefined, adId: string | undefined, dateParam?: string): string | null {
  if (!accountId || !adId) return null;
  const filter = encodeURIComponent(JSON.stringify([{ field: "ad.id", operator: "IN", value: [adId] }]));
  let url = `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${encodeURIComponent(accountId)}&filter_set=${filter}&selected_ad_ids=${encodeURIComponent(adId)}`;
  if (dateParam) url += `&date=${encodeURIComponent(dateParam)}`;
  return url;
}
